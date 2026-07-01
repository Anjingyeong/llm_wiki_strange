---
title: "2026-06-30 작업 로그: Overlay Sync, Tracking, Evidence & Data Pipeline"
category: Project
updatedAt: "2026-06-30"
---

## 1. 오늘 진행한 내용 요약

* **방향성 조정**: 초기에 Self-Improving AI / VLM / Synthetic Data 도입을 바로 고려했으나, 현재 AI 파이프라인에서 **frame evidence chain 정합성**이 먼저 보장되지 않으면 자동화된 재학습이 위험하다고 판단했습니다. 따라서 오늘 하루는 정합성 및 렌더링 품질 개선에 집중했습니다.
* **Payload 정합성**: RTSP latest-frame buffer/queue drop 이후, 최종 발행되는 payload가 단순히 reader의 최신 프레임이 아니라 실제 AI 모델이 처리한(Processed) FramePacket 기준이어야 함을 구조적으로 점검하고 정리했습니다.
* **Evidence Chain**: `evidenceId = {cameraLoginId}-{frameId}-{capturedAtMs}`를 기준으로 overlay, event, frame_sync, clip metadata를 모두 하나로 묶는 구조를 확립했습니다.
* **Overlay Sync 진단**: 프론트엔드 overlay-sync 로그에서 `frameId=n/a`, `capturedAtMs=n/a`, `publishedAtMs=n/a`, `bufferSize=1` 현상이 관측되었습니다. 이는 AI raw payload builder는 보강되었으나, 중간의 Backend(clear overlay 로직) 또는 Frontend(normalization 파싱 로직) Handoff 과정에서 필드가 누락되는 문제로 분리 진단했습니다.
* **프론트엔드 렌더링 오류 수정**: 
  * `CameraAiOverlay` 컴포넌트의 Maximum update depth 초과 오류 원인을 진단하고 수정했습니다.
  * 모든 BBox가 `FAINT 12%`, `FAINT 17%`처럼 빨간색으로 표시되던 문제(문자열/숫자 파싱 및 임계값 0.5 미만 미적용 문제)를 해결하여, 일반 객체는 `ID_n`(Sky-blue)으로, 실제 이벤트 객체는 `FAINT xx%`(Rose)로 분리 렌더링하도록 수정했습니다.
* **프레임 동기화 및 스케일링**: Object-fit contain에 맞춘 좌표 scaling 보정, overlay timestamp selection 로직 개선, 그리고 stale(오래된) 패킷 fallback skip 로직을 점검했습니다.
* **Tracking 품질 점검**: ByteTrack 및 supervision tracking 품질을 점검했으며, 화면에 표시되는 `ID_n`이 실제 ByteTrack의 trackId인지 아니면 index 기반 fallback ID인지 식별하는 로직을 추가했습니다.
* **정량 검증 체계 도입**: 감에 의존한 파라미터 튜닝을 막기 위해 4단계 정량 로그를 구축했습니다.
  1. Detection
  2. Tracking
  3. Classification
  4. Rendering
  * 프론트엔드 메트릭: `fallbackIdRate`, `missingBBoxRate`, `trackSwitchCount`, `avgSelectedDeltaMs`, `maxSelectedDeltaMs`
* **이벤트 클립 위임**: 10초 HLS clip 생성 / S3 업로드 / MQTT metadata 발행 구조는 아키텍처 설계를 완료하고 구현은 팀원에게 위임했습니다.
* **다음 작업**: 이후 진행할 작업은 Hard Negative Mining과 Synthetic Augmentation Dataset Pipeline 구축입니다.

---

## 2. RTSP Latest-Frame Buffer 점검

RTSP latest-frame queue는 실시간 추론용으로, 오래된 프레임을 drop하고 최신 프레임을 AI에 넘기는 구조가 올바릅니다. queue drop이 발생해도 데이터 정합성이 유지되는지 점검했습니다.

### RTSP Buffer 구조 판단 (확인 결과)

| 항목 | 내용 |
| :--- | :--- |
| **현재 구조** | `CameraFrameQueue`가 일정 큐 사이즈 초과 시 프레임을 Drop하고 최신 프레임만 유지 |
| **정상 여부** | **정상 (문제 없음)** |
| **근거** | 추론 지연에 따른 메모리 폭발을 막고 '실시간성'을 유지하기 위한 올바른 설계임 |
| **정합성 유지 방식** | AI 추론 결과 페이로드는 `processedAtMs` 시점의 실제 처리된 `FramePacket` 내부의 `frameId`, `capturedAtMs`, `cameraLoginId`, `evidenceId`, `traceId`, `droppedFrameCount`를 기반으로 빌드됨 |
| **남은 위험 요소** | RTSP 재연결 시 `frameId`가 0으로 초기화되거나 `droppedFrameCount`가 비정상 누적 증분될 위험 (추후 스트림 재시작 시점의 로직 확인 필요) |

> **문서화 포인트**: 큐가 프레임을 Drop함에 따라 payload의 `frameId`가 중간중간 건너뛰는 현상(ex: 1, 3, 7...)은 지극히 정상적인 동작이며 오류가 아닙니다.

---

## 3. 이벤트 영상 Clip Buffer 점검

RTSP latest-frame queue와 이벤트 Clip Buffer는 역할이 분리되어야 합니다. Latest-frame queue는 '가장 최신 프레임을 빨리 추론'하기 위함이며, Clip Buffer는 '과거 프레임을 보존'하기 위함입니다.

### Clip Buffer 구조 판단 (설계 내역)

| 항목 | 내용 |
| :--- | :--- |
| **필요한 구조** | `cameraLoginId`별로 독립된 5초 길이의 링 버퍼 유지 |
| **현재 구현 여부** | **미구현 (팀원 위임)** |
| **추가 구현 필요 항목** | AI 워커 내 비동기 HLS 인코더 쓰레드, IAM Role 기반 S3 업로더, MQTT `safety/event-clips` 메타데이터 퍼블리셔 |
| **팀원 위임 범위** | 위 추가 구현 필요 항목 전체 (보고서 작성 완료, 본 Wiki에 아키텍처 요약) |

**클립 정책 가이드라인:**
* 10초 HLS 포맷 우선 (Pre-event 5초 + Post-event 5초)
* **중복 방지 (Cooldown)**: `cameraLoginId` + `eventType` 기준 Active task lock 및 20~30초 Cooldown. (10초 Cooldown만으로는 사후 5초 수집 + 인코딩 + 네트워크 지연 시 중첩 생성이 발생할 수 있음)
* 영상 Binary 자체를 MQTT로 직접 쏘지 않고, S3 업로드 후 Backend가 프론트엔드에 Presigned URL을 발급하는 `s3Key` 중심 저장 방식을 유지합니다.

---

## 4. Overlay Sync Field 상태 및 Tracking 품질 검증

### Overlay Sync Field 상태 파악

| 영역 | 상태 및 조치 사항 |
| :--- | :--- |
| **AI-side 상태** | `evidenceId`, `capturedAtMs` 등을 포함하도록 raw payload builder 보강 (완료) |
| **Backend Handoff** | DTO 변환 과정이나 clear overlay 메시지 병합 시 필드 누락 위험 (남은 확인 사항) |
| **Frontend Handoff** | WebSocket STOMP 수신 후 payload 정규화(Normalization) 과정 필드 유실 여부 (일부 보강 완료) |
| **남은 확인 사항** | 실제 운영계에서 `frameId=n/a`가 완전히 사라졌는지 End-to-End 로깅 모니터링 필요 |

### Tracking 품질 검증 상태

| 항목 | 내용 |
| :--- | :--- |
| **구현된 정량 로그** | AI 4단계 Stage Log (Detection, Tracking, Classification, Payload) + Frontend 10초 주기 Metrics Log |
| **확인할 지표** | 프론트엔드 기준 `fallbackIdRate`, `missingBBoxRate`, `trackSwitchCount`, `avgSelectedDeltaMs`, `maxSelectedDeltaMs` |
| **다음 튜닝 기준** | `fallbackIdRate`가 높으면 ByteTrack `match-thresh` 튜닝, `avgSelectedDeltaMs`가 높으면 렌더링 프레임 지연 오프셋 튜닝 |

---

## 5. Hard Negative / Synthetic Data 계획 (Next Steps)

AI 성능 고도화를 위한 재학습 데이터 파이프라인 계획을 확립했습니다. 본 파이프라인은 Self-Improving AI의 첫 단계로 기존 `metadata.csv`를 보완하는 `training_manifest_v2.csv` 생성을 목표로 합니다.

### 5.1 Hard Negative Mining
* **오탐(False Positive) 활용**: 허리 굽힘, 앉기, 물건 줍기, 소파에 눕기, 가림, 정상 기댐 등 쓰러짐으로 오인된 데이터를 Normal 레이블 후보로 Export합니다.
* **워크플로우**: 곧바로 학습 데이터에 넣지 않고 `review_status=pending` 상태로 저장한 뒤, 사람이 검수한(Approved) 데이터만 `training_manifest_v2`에 포함시킵니다.

### 5.2 Faint Reinforcement
* **미탐(False Negative) 활용**: 야간, 원거리, 가림, 천천히 쓰러짐, 작은 사람 등 놓친 진짜 쓰러짐 데이터를 Faint 후보로 Export합니다.

### 5.3 Synthetic Data Augmentation
* **개요**: 무거운 생성형(GenAI) 영상 모델 대신 기존 클립의 고전적인 비전 Augmentation을 기반으로 시작합니다.
* **증강 기법**: Brightness, Noise, Blur, Compression, Scale down, Partial occlusion, Horizontal flip
* **데이터 누수 방지 (중요)**: 증강 데이터는 원본 영상의 `parent_clip_id`를 반드시 기록하며, Train/Test split 시 Parent 단위로 이동시켜 Leakage를 방지합니다.
* **비율 통제**: 원본 데이터 대비 과적합 방지를 위해 기본 `max_synthetic_ratio=0.3`으로 제한합니다. 실험의 재현성을 위해 Random seed와 Augmentation config를 메타데이터에 기록합니다.

---

> **Note**: 위 설계 및 구조 점검에 따른 코드 기능 추가 구현(Clip Recorder, S3 Uploader, Hard Negative Exporter 등)은 본 Goal의 범위 밖이며 다음 태스크(또는 팀원 위임)로 이관됩니다.

## 6. 향후 과제 및 To-Do List (내일 보고 및 팀 역할 분담용)

내일 회의 및 보고에서 팀원 간 분배하고 진행해야 할 잔여(To-Do) 태스크 목록입니다.

### 👥 팀원 위임 태스크 (AI 영상 처리 및 Backend 연동)
- [ ] **이벤트 10초 영상 Clip Recorder 구현**: RTSP Latest-frame 큐와 별개로 이벤트 발생 전 5초 영상을 보존하는 링 버퍼 구현.
- [ ] **HLS 인코딩 모듈 추가**: ffmpeg 등을 사용하여 10초 영상을 HLS(`.m3u8`, `.ts`) 포맷으로 인코딩하는 비동기 워커 생성.
- [ ] **S3 Uploader 구현**: 클립 생성 후 IAM Role 인증 기반으로 S3에 업로드하는 로직 작성.
- [ ] **클립 Cooldown 정책 반영**: 10초 클립 중복 생성 방지를 위한 `cameraLoginId` + `eventType` 기준 Active Task Lock 및 30초 쿨다운 적용.
- [ ] **MQTT Metadata Publisher 구현**: S3 업로드 완료 후 신규 토픽 `safety/event-clips`으로 `event_clip_ready` 메타데이터 전송.
- [ ] **Backend 연동 개발**: 
  - `safety/event-clips` 수신 및 DTO 매핑.
  - `evidenceId` 매칭 후 AlertEvent DB에 S3 Key(`clipS3Key`) 업데이트.
  - 프론트엔드 조회 API에 S3 Presigned URL (10분 만료) 발급 로직 추가.
- [ ] **Frontend 연동 개발**: 모달 창에서 Presigned URL 존재 시 Snapshot이 아닌 HLS 영상으로 재생 처리 (`hls.js` 연동 포함).

### 🚀 본인(담당자) 직접 진행 태스크 (AI 성능 고도화 파이프라인)
- [ ] **Hard Negative Mining 자동화 파이프라인**: 
  - LSTM 오탐(False Positive) 데이터를 추출해 Normal 후보로 설정.
  - `review_status=pending` 상태로 로컬 폴더 또는 CSV에 내보내는 스크립트 작성.
- [ ] **Faint Reinforcement(FN) 수집 파이프라인**: 놓친 쓰러짐 데이터를 Faint 후보로 추출하는 스크립트 작성.
- [ ] **Synthetic Data Augmentation 스크립트 구축**: 
  - Blur, Noise, Compression, Occlusion 등 비전 기반 증강 처리 모듈 개발.
  - 데이터 누수(Data Leakage)를 막기 위해 `parent_clip_id`를 보존하며 Split을 동기화하는 로직 반영.
- [ ] **재학습 Manifest 분리**: 원본 `metadata.csv`를 보존하면서 위 데이터들을 합친 `training_manifest_v2.csv` 생성 자동화.

### ⚠️ 인프라 및 예외 상황 점검 항목 (To-Do)
- [ ] 스트림 비정상 종료 후 RTSP 재연결 시 `frameId`가 초기화될 경우 프론트엔드 재생에 미치는 E2E 영향 테스트.
- [ ] AI 파이프라인에 추가한 `evidenceId` 등 동기화 필드들이 Spring Backend DTO 바인딩 및 Frontend Payload 파싱 과정에서 손실 없이 전달되는지 E2E 로깅 점검 (`frameId=n/a` 에러 근절 확인).
- [ ] HLS 세그먼트 사이즈 결정 (예: 2초 단위 5개 vs 5초 단위 2개) 및 로컬 임시 영상 파일의 즉각 삭제 정책 확립.

---
#"AI" #"Overlay" #"Sync" #"Tracking" #"Hard Negative" #"Synthetic Data"
