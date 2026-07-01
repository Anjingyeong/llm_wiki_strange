---
title: 면접·이력서 정리
category: 면접·이력서 정리
updatedAt: 2026-06-30
relatedDocs: [2026-06-30-Overlay-Tracking-Evidence-Log, AI-Pipeline, Architecture, Frame-Matching-Report]
relatedFiles: [docs/tracking_validation_report.md, docs/overlay_bbox_diagnosis_report.md, docs/event_clip_hls_s3_mqtt_plan.md, docs/self_improving_ai_synthetic_vlm_architecture.md]
---

이 문서는 LLM Wiki의 기술 문서를 그대로 복사하는 공간이 아니라, AI 안전 관제 프로젝트의 작업 로그를 취업용 표현으로 변환하는 공간이다. 아직 실제 운영 환경에서 끝까지 검증하지 못한 내용은 `진행 중`, `검증 필요`, `팀원 위임`으로 표시한다.

## 1. 나의 포지셔닝

- 실시간 영상 AI 파이프라인에서 모델 성능만 보지 않고, RTSP 입력, 프레임 메타데이터, 추적 ID, MQTT payload, Backend relay, Frontend overlay 렌더링까지 연결해 문제를 추적하는 개발자.
- 낙상/실신 감지처럼 오탐과 미탐의 비용이 큰 도메인에서, 감각적인 튜닝보다 evidence chain, 정량 로그, 재현 가능한 데이터 파이프라인을 먼저 세우는 방향을 선호한다.
- Edge AI, 실시간 관제, AI Governance 관점에서 "모델이 맞췄다"보다 "왜 그렇게 판단했고 어떤 프레임과 이벤트가 연결되는지 설명할 수 있는가"를 중시한다.

## 2. 프로젝트 한 줄 설명

CCTV/RTSP 스트림을 실시간으로 분석해 실신·쓰러짐 위험 이벤트를 감지하고, MQTT/Backend/WebSocket/Frontend overlay로 관제자가 확인할 수 있게 연결하는 AI 안전 관제 시스템.

## 3. 핵심 기술 스택

| 영역 | 기술 | 이력서 표현 포인트 |
| :--- | :--- | :--- |
| 영상 입력 | RTSP, MediaMTX, WebRTC/HLS | 실시간 스트림 수신과 관제 화면 재생 경로를 분리해 지연과 안정성을 관리 |
| AI 추론 | YOLO Pose, LSTM, keypoint sequence | 사람 bbox/keypoint 기반 행동 분류 파이프라인 구성 |
| Tracking | ByteTrack, supervision, per-track sequence buffer | 동일 객체 ID 유지와 LSTM sequence 정합성 검증 |
| 이벤트 전송 | MQTT `safety/events`, STOMP/WebSocket | AI 이벤트를 Backend와 Frontend로 전달하는 비동기 이벤트 흐름 |
| 증거 추적 | `frameId`, `capturedAtMs`, `evidenceId`, `traceId` | 프레임·이벤트·오버레이·클립을 하나의 증거 체인으로 묶는 설계 |
| 검증 | stage log, overlay metrics, benchmark scripts | Detection/Tracking/Classification/Rendering 단계별 정량 진단 |
| 데이터 개선 | hard negative mining, synthetic augmentation | FP/FN 기반 재학습 후보 수집과 데이터 누수 방지 설계 |

## 4. Evidence Map

| 작업 | 문제 | 내가 한 판단 | 적용 기술 | 결과 | 이력서 문장 후보 | 면접 질문 후보 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RTSP latest-frame buffer | 실시간 추론에서 오래된 프레임이 큐에 쌓이면 지연이 누적되고 관제 화면이 현재 상황과 어긋날 수 있음 | 최신 프레임 우선 구조는 유지하되, payload는 reader의 최신값이 아니라 실제 모델이 처리한 FramePacket 기준으로 만들어야 한다고 판단 | latest-frame queue, frame drop, `frameId`, `capturedAtMs`, `droppedFrameCount` | 실시간성 유지와 증거 정합성 요구를 분리해 문서화. E2E 재연결 케이스는 `검증 필요` | RTSP latest-frame queue에서 frame drop을 허용하되, AI payload를 실제 처리 프레임 기준으로 구성해 실시간성과 증거 정합성을 분리 관리했습니다. | 최신 프레임만 유지하면 어떤 데이터 정합성 문제가 생길 수 있나요? |
| frame evidence chain | overlay, event, frame_sync, clip metadata가 서로 다른 기준으로 움직이면 사고 증거 추적이 어려움 | `evidenceId = cameraLoginId-frameId-capturedAtMs`를 중심으로 프레임·이벤트·클립을 묶는 것이 먼저라고 판단 | `evidenceId`, `traceId`, frame metadata, MQTT metadata | 증거 체인 기준을 확립. Backend/Frontend 전체 전달 유실 여부는 `검증 필요` | AI 이벤트의 `frameId`, `capturedAtMs`, `evidenceId`를 표준화해 오버레이와 이벤트 클립이 같은 프레임을 참조하도록 증거 체인 설계를 정리했습니다. | evidenceId를 왜 별도로 두었고, eventId와는 어떻게 다른가요? |
| overlay sync | 프론트엔드에서 bbox가 실제 사람 위치를 늦게 따라가거나 사라지는 현상이 발생 | 단일 화면 버그가 아니라 AI timestamp, Backend relay, Frontend buffer selection을 나눠 봐야 한다고 판단 | overlay buffer, timestamp matching, `avgSelectedDeltaMs`, stale fallback skip | 원인 분리와 진단 지표를 정리. 운영계 로그 기반 확인은 `검증 필요` | WebRTC overlay 지연 문제를 timestamp matching과 stale packet 처리 문제로 분리하고, `avgSelectedDeltaMs` 기반 진단 기준을 마련했습니다. | overlay가 늦게 따라가는 현상을 어떤 단계로 나눠 디버깅했나요? |
| CameraAiOverlay maximum update depth 오류 | React overlay 컴포넌트가 무한 업데이트에 빠져 화면 안정성이 깨짐 | 렌더링 상태 계산과 effect/update 의존성을 분리해야 한다고 판단 | React state/effect, overlay normalization | 오류 원인 진단 및 수정 반영. 회귀 테스트 범위는 `검증 필요` | `CameraAiOverlay`의 maximum update depth 오류를 상태 갱신 의존성 문제로 분리 진단하고, 오버레이 렌더링 안정성을 회복했습니다. | React maximum update depth 오류는 왜 발생하고 어떻게 재발을 막나요? |
| FAINT/ID bbox 렌더링 분리 | 일반 객체도 `FAINT 12%`처럼 빨간 박스로 표시되어 관제자가 오탐으로 인식할 수 있음 | confidence 값이 12 또는 `12%`로 들어오는 경우를 0.12로 정규화한 뒤 이벤트 여부를 판단해야 한다고 판단 | confidence normalization, threshold 0.5, normal/event variant 분리 | 일반 객체는 `ID_n`, 실제 이벤트 후보는 `FAINT xx%`로 분리. 실환경 장시간 검증은 `검증 필요` | confidence percent 값 정규화 누락으로 모든 bbox가 FAINT로 표시되던 문제를 해결하고, 일반 추적 ID와 이벤트 강조 렌더링을 분리했습니다. | confidence 12와 0.12가 섞여 들어오면 어떤 장애가 생기나요? |
| object-fit coordinate scaling | `object-fit: contain` 화면에서 원본 좌표와 표시 좌표가 어긋날 수 있음 | AI bbox 원본 프레임 좌표를 비디오 표시 영역의 letterbox offset과 scale에 맞춰 변환해야 한다고 판단 | coordinate scaling, contain fit, bbox clamp | 좌표 보정 로직 점검 및 문서화. 다양한 해상도 조합은 `검증 필요` | `object-fit: contain` 환경에서 원본 프레임 bbox를 실제 비디오 표시 영역으로 변환해 overlay drift 원인을 줄였습니다. | object-fit이 bbox 좌표에 어떤 영향을 주나요? |
| ByteTrack/supervision tracking 검증 | YOLO detection은 되지만 track ID가 자주 바뀌면 LSTM sequence가 다른 사람의 keypoint와 섞일 수 있음 | 중복 IoU matching을 줄이고 ByteTrack 결과를 per-track sequence에 직접 연결하는 것이 중요하다고 판단 | ByteTrack, supervision, `track_id`, per-track buffer, EMA bbox smoothing | 단위 테스트와 추적 진단 로그로 구조 검증. 운영계 tuning은 `진행 중` | ByteTrack/supervision 후처리에서 중복 matching 위험을 점검하고, track ID와 LSTM sequence buffer의 결합 구조를 검증했습니다. | track ID 안정성이 LSTM 행동 분류에 왜 중요한가요? |
| tracking 정량 지표 | ID 흔들림과 bbox 누락을 감으로 판단하면 파라미터 변경 부작용을 확인하기 어려움 | Detection, Tracking, Classification, Rendering을 분리해 단계별 지표를 모아야 한다고 판단 | stage log, `fallbackIdRate`, `missingBBoxRate`, `trackSwitchCount`, `avgSelectedDeltaMs` | 정량 지표 체계 구축. 목표 수치 확정은 `검증 필요` | AI 추적 품질을 감각적으로 튜닝하지 않도록 4단계 stage log와 프론트엔드 overlay metrics를 정의했습니다. | fallbackIdRate가 높다면 어느 계층을 먼저 확인하겠습니까? |
| 10초 HLS clip + S3 + MQTT 설계 | 사고 알림만으로는 사후 확인에 필요한 전후 맥락 영상이 부족함 | 즉시 알림과 지연 생성되는 evidence clip을 분리하고, 영상 바이너리는 MQTT가 아니라 S3 key로 전달해야 한다고 판단 | HLS, S3, Presigned URL, MQTT `safety/event-clips`, active lock, cooldown | 아키텍처 설계 완료. 구현은 `팀원 위임`, E2E는 `검증 필요` | 이벤트 전후 10초 HLS 클립을 S3에 저장하고 MQTT로 metadata만 전송하는 증거 영상 아키텍처를 설계했습니다. | 왜 영상 바이너리를 MQTT로 직접 보내지 않았나요? |
| hard negative mining | 쓰러짐이 아닌 행동이 오탐으로 쌓이면 threshold 조정만으로는 재발 방지가 어려움 | FP를 곧바로 학습에 넣지 않고 `review_status=pending`으로 보관한 뒤 승인 데이터만 재학습 후보로 써야 한다고 판단 | FP export, review status, `training_manifest_v2`, human-in-the-loop | 파이프라인 방향 수립. exporter 구현은 `진행 중` | LSTM 오탐 사례를 hard negative 후보로 분류하고, 검수 후 재학습 manifest에 반영하는 데이터 개선 흐름을 설계했습니다. | hard negative mining에서 사람이 검수해야 하는 이유는 무엇인가요? |
| synthetic augmentation | 야간, 원거리, 가림, blur 같은 약한 조건을 실제 데이터만으로 충분히 모으기 어려움 | 생성형 영상보다 먼저 기존 클립 기반의 재현 가능한 비전 augmentation과 parent 단위 split 관리가 적절하다고 판단 | brightness, noise, blur, compression, occlusion, `parent_clip_id`, `max_synthetic_ratio` | manifest skeleton 및 정책 정리. 실제 증강 파일 생성과 성능 검증은 `진행 중` | Synthetic augmentation 후보를 만들 때 `parent_clip_id`와 합성 비율 제한을 둬 데이터 누수와 과적합 위험을 관리하도록 설계했습니다. | synthetic data를 쓸 때 train/test leakage를 어떻게 막나요? |

## 5. 이력서 문장 Bank

바로 복붙 가능한 bullet 초안이다. 실제 제출 전에는 지원 직무와 검증 상태에 맞춰 `진행 중`, `검증 필요`, `팀원 위임` 표현을 유지하거나 제거한다.

- RTSP latest-frame queue에서 frame drop을 허용하되, AI payload를 실제 처리 프레임 기준으로 구성해 실시간성과 증거 정합성을 분리 관리했습니다.
- `frameId`, `capturedAtMs`, `evidenceId`를 기준으로 AI event, overlay, frame_sync, clip metadata를 연결하는 evidence chain 설계를 정리했습니다.
- WebRTC overlay 지연 문제를 AI timestamp, Backend relay, Frontend buffer selection 단계로 나누고 `avgSelectedDeltaMs` 기반 진단 기준을 마련했습니다.
- `CameraAiOverlay`의 maximum update depth 오류를 상태 갱신 의존성 문제로 분리 진단하고 오버레이 렌더링 안정성을 개선했습니다.
- confidence 값이 percent와 decimal로 혼재해 모든 bbox가 FAINT로 표시되던 문제를 정규화 로직으로 분리 해결했습니다.
- 일반 객체는 `ID_n`, 실제 이벤트 후보는 `FAINT xx%`로 렌더링되도록 bbox label/variant 판단 기준을 정리했습니다.
- `object-fit: contain` 환경에서 원본 bbox 좌표를 비디오 표시 영역의 scale/offset에 맞춰 보정해 overlay drift 원인을 줄였습니다.
- ByteTrack/supervision 기반 tracking 결과가 LSTM per-track sequence buffer에 안정적으로 연결되는지 구조와 테스트 관점에서 검증했습니다.
- `fallbackIdRate`, `missingBBoxRate`, `trackSwitchCount`, `avgSelectedDeltaMs` 등 프론트엔드 overlay metrics를 정의해 tracking 품질을 정량 진단할 수 있게 했습니다.
- Detection, Tracking, Classification, Payload, Rendering 단계로 로그를 분리해 AI 관제 파이프라인의 병목과 오표시 원인을 추적했습니다.
- 이벤트 전후 10초 HLS 클립을 S3에 저장하고 MQTT로 metadata만 전송하는 증거 영상 아키텍처를 설계했습니다. (`팀원 위임`)
- 영상 클립 저장 설계에서 S3 public URL 대신 `s3Key`와 Backend Presigned URL 발급 구조를 선택해 보안 리스크를 낮췄습니다. (`설계 완료`, `검증 필요`)
- LSTM 오탐 사례를 hard negative 후보로 분류하고 검수 후 재학습 manifest에 반영하는 데이터 개선 흐름을 설계했습니다. (`진행 중`)
- Synthetic augmentation 후보 생성 시 `parent_clip_id`와 합성 비율 제한을 둬 train/test leakage와 과적합 위험을 관리하도록 설계했습니다. (`진행 중`)
- Self-Improving AI/VLM/Synthetic Data 도입 전, 먼저 evidence chain 정합성을 확보해야 한다고 판단해 실시간 AI 파이프라인의 검증 기반을 우선 정비했습니다.

## 6. 면접 질문 Bank

- RTSP latest-frame buffer에서 frame drop은 왜 정상 동작일 수 있나요?
- latest-frame queue와 event clip ring buffer는 왜 분리해야 하나요?
- `evidenceId`를 어떤 필드로 구성했고, eventId와 어떤 차이가 있나요?
- overlay가 실제 사람 위치보다 늦게 따라가는 현상을 어떤 단계로 나눠 디버깅했나요?
- React `maximum update depth` 오류는 어떤 상황에서 발생하고 어떻게 재발을 막을 수 있나요?
- confidence 값이 `12`, `12%`, `0.12`처럼 섞여 들어오면 어떤 장애가 생기나요?
- FAINT 렌더링과 일반 ID 렌더링을 분리한 기준은 무엇인가요?
- `object-fit: contain`이 bbox 좌표 변환에 어떤 영향을 주나요?
- ByteTrack track ID가 흔들리면 LSTM 행동 분류에 어떤 문제가 생기나요?
- `fallbackIdRate`가 높다면 AI, Backend, Frontend 중 어디를 먼저 확인하겠습니까?
- HLS clip을 MQTT로 직접 보내지 않고 S3 + metadata 방식으로 설계한 이유는 무엇인가요?
- hard negative mining에서 사람이 승인한 데이터만 재학습 후보로 쓰려는 이유는 무엇인가요?
- Synthetic augmentation에서 `parent_clip_id`를 보존해야 하는 이유는 무엇인가요?
- VLM을 바로 최종 판단기로 쓰지 않고 mock adapter 또는 보조 설명기로 둔 이유는 무엇인가요?
- 실시간 AI 파이프라인에서 "성능 개선"을 주장하려면 어떤 지표가 필요하다고 보나요?
- 2026년 Edge AI 트렌드와 이 프로젝트의 연결점은 무엇인가요?
- AI Governance 관점에서 evidence chain은 어떤 의미가 있나요?
- 팀원에게 위임한 작업과 본인이 직접 수행한 작업을 면접에서 어떻게 구분해 설명하겠습니까?

## 7. STAR 답변

### STAR 1. Overlay 오표시와 FAINT/ID 렌더링 분리

- Situation: 관제 화면에서 일반 사람 bbox도 `FAINT 12%`처럼 빨간색 이벤트로 표시되어, 실제 위험 이벤트와 일반 추적 객체가 구분되지 않는 문제가 있었다.
- Task: AI payload, Frontend parsing, 렌더링 기준 중 어디에서 오표시가 생기는지 분리하고 관제자가 이해할 수 있는 label 기준을 만들어야 했다.
- Action: confidence 값이 `12`, `12%`, `0.12`처럼 혼재될 수 있다고 보고 percent 값을 decimal로 정규화한 뒤 threshold와 event flag를 함께 확인하도록 기준을 정리했다. 일반 객체는 `ID_n`, 이벤트 후보는 `FAINT xx%`로 표시하도록 렌더링 의미를 분리했다.
- Result: 오표시 원인을 "모델이 모두 FAINT로 판단한 것"이 아니라 "표시 계층에서 confidence 단위가 정규화되지 않은 것"으로 좁혔다. 장시간 운영계 검증은 `검증 필요`지만, 문제 해결 방향과 재발 방지 지표를 명확히 했다.

### STAR 2. Evidence chain 우선순위 판단

- Situation: Self-Improving AI, VLM, Synthetic Data를 도입하면 프로젝트가 더 최신 트렌드에 가까워 보일 수 있었지만, 당시 pipeline에서는 frameId와 timestamp가 중간 계층에서 유실될 가능성이 있었다.
- Task: 다음 고도화 작업을 바로 시작할지, 먼저 이벤트 증거 정합성을 확보할지 결정해야 했다.
- Action: 자동 재학습이나 VLM 판단은 잘못 연결된 프레임을 학습·설명할 경우 오히려 위험하다고 판단했다. 그래서 `cameraLoginId-frameId-capturedAtMs` 기반 `evidenceId`를 중심으로 overlay, event, frame_sync, clip metadata를 묶는 방향을 먼저 정리했다.
- Result: 최신 기술 도입보다 검증 가능한 증거 체인을 우선하는 의사결정을 내렸다. 이후 hard negative mining, synthetic augmentation, VLM 보조 판단을 안전하게 붙일 수 있는 기반을 마련했다. E2E 전달 유실 여부는 `검증 필요`다.

### STAR 3. Tracking 품질을 감이 아닌 지표로 보기

- Situation: bbox가 흔들리거나 ID가 바뀌는 현상이 있었지만, 단순히 ByteTrack threshold를 바꾸면 다른 카메라나 행동 분류에 부작용이 생길 수 있었다.
- Task: 파라미터를 조정하기 전에 어떤 단계에서 문제가 생기는지 확인할 수 있는 기준이 필요했다.
- Action: Detection, Tracking, Classification, Payload, Rendering 단계를 나눠 stage log와 overlay metrics를 정의했다. `fallbackIdRate`, `trackSwitchCount`, `missingBBoxRate`, `avgSelectedDeltaMs`를 확인해 ID 문제인지, bbox 누락인지, timestamp delay인지 구분하도록 정리했다.
- Result: tracking 품질 논의를 "화면이 이상하다"에서 "어느 단계의 어떤 지표가 악화됐는가"로 바꿀 수 있었다. 실제 파라미터 최적화 목표 수치는 아직 `검증 필요`다.

### STAR 4. 10초 HLS evidence clip 설계

- Situation: 사고 알림만으로는 관제자가 이벤트 전후 맥락을 확인하기 어렵고, 영상 바이너리를 이벤트 메시지에 직접 실으면 MQTT와 Backend 모두에 부담이 커질 수 있었다.
- Task: 즉시 알림은 유지하면서, 사후 확인용 영상 증거를 안전하게 연결하는 구조가 필요했다.
- Action: 이벤트 발생 전 5초와 후 5초를 합친 10초 HLS clip을 AI가 생성하고, S3에는 `s3Key` 중심으로 저장하며, MQTT에는 `event_clip_ready` metadata만 보내는 구조를 설계했다. Backend가 권한 확인 후 Presigned URL을 발급하는 방식으로 보안 경계를 나눴다.
- Result: 즉시 이벤트 알림과 지연 생성되는 영상 증거를 분리한 설계를 만들었다. 구현은 `팀원 위임`, E2E 검증은 `검증 필요`로 관리한다.

## 8. 2026 트렌드 매핑

| 키워드 | 프로젝트와 맞는 연결점 | 현재 상태 | 이력서 표현 주의 |
| :--- | :--- | :--- | :--- |
| Edge AI | RTSP 스트림을 AI 워커가 실시간 처리하고 MQTT로 이벤트를 발행 | `진행 중` | "엣지 환경 최적화 완료"가 아니라 "실시간 edge-style inference pipeline 정합성 점검"으로 표현 |
| Synthetic Data | 야간, 원거리, 가림, blur 조건을 기존 클립 기반 augmentation 후보로 보강 | `진행 중` | 성능 향상 수치를 만들지 않고 leakage 방지 설계를 강조 |
| Self-Improving AI | FP/FN 피드백을 hard negative 및 faint reinforcement 후보로 export | `진행 중` | 자동 재학습 완료가 아니라 human-in-the-loop 후보 수집 구조로 표현 |
| Multimodal/VLM | VLM은 최종 판단기가 아니라 snapshot/clip 기반 설명·검수 보조 후보 | `검증 필요` | "VLM 도입"보다 "VLM adapter 검토 및 보조 판단 설계"로 표현 |
| AI Governance | `evidenceId`, frame metadata, clip metadata를 연결해 판단 근거 추적 가능성 확보 | `진행 중` | 규제 대응 완료가 아니라 auditability 기반 설계로 표현 |
| Real-time AI Pipeline | RTSP, YOLO/LSTM, MQTT, Backend relay, Frontend overlay를 실시간으로 연결 | `진행 중` | 검증된 latency 수치가 없으면 "저지연 달성" 대신 "latency metric 정의"로 표현 |

## 9. 정량 지표/성과

아직 실제 확인되지 않은 성과 수치는 만들지 않는다. 현재 문서에 남길 수 있는 정량 항목은 "측정 대상"과 "확보해야 할 값" 중심이다.

| 지표 | 의미 | 현재 상태 | 이력서 반영 방식 |
| :--- | :--- | :--- | :--- |
| `fallbackIdRate` | track ID가 없어 index 기반 ID로 렌더링된 비율 | 측정 체계 정의, 운영 수치 `검증 필요` | "추적 ID fallback 비율을 관찰하는 metric 정의" |
| `missingBBoxRate` / `missingBboxFrames` | 이벤트는 왔지만 bbox가 화면에 렌더링되지 않은 비율/프레임 | 측정 체계 정의, 운영 수치 `검증 필요` | "bbox 누락 진단 지표 정의" |
| `trackSwitchCount` | 같은 객체의 ID 변경 추정 횟수 | 측정 체계 정의, 운영 수치 `검증 필요` | "ID switch 진단 기준 마련" |
| `avgSelectedDeltaMs` / `maxSelectedDeltaMs` | 비디오 프레임과 overlay timestamp 차이 | 측정 체계 정의, 운영 수치 `검증 필요` | "overlay sync 지연 metric 정의" |
| Stage 1 `det_count`, `avg_conf` | Detection 단계 품질 | 로그 구조 확인, 장시간 수집 `검증 필요` | "Detection 단계별 로그 분리" |
| Stage 2 `lost_tracks`, `new_tracks` | Tracking 단계 안정성 | 로그 구조 확인, tuning `진행 중` | "ByteTrack 추적 품질 진단 로그 구성" |
| Stage 3 `faint_prob`, `event_triggered` | Classification threshold 판단 | 로그 구조 확인, threshold audit `검증 필요` | "분류 threshold와 이벤트 발생 여부 분리 관찰" |
| Stage 4 `event_count`, `isEvent` | Payload와 렌더링 후보 전달 | 로그 구조 확인, E2E `검증 필요` | "payload 전달 전 최종 이벤트 상태 점검" |

## 10. 시행착오/문제 해결 로그

처음에는 Self-Improving AI, VLM, Synthetic Data를 빠르게 도입하면 프로젝트의 고도화 방향을 잘 보여줄 수 있다고 생각했다. 하지만 RTSP latest-frame queue에서 frame drop이 정상적으로 발생하고, Backend/Frontend handoff 중 `frameId=n/a`, `capturedAtMs=n/a` 같은 유실 가능성이 있는 상태에서는 고도화 모델이 잘못된 증거를 학습하거나 설명할 수 있다고 판단했다.

그래서 우선순위를 바꿨다. 먼저 frame evidence chain 정합성을 확보하고, overlay sync와 bbox 렌더링이 같은 프레임 기준으로 움직이는지 확인한 뒤, 그 위에 hard negative mining과 synthetic augmentation을 붙이는 흐름이 더 안전하다고 봤다. 이 판단 변화는 면접에서 "최신 기술을 무조건 붙인 것이 아니라, 운영 가능한 AI 시스템에서 신뢰 가능한 증거 체인을 먼저 세웠다"는 사례로 설명할 수 있다.

문제 해결 과정에서 얻은 교훈:

- 프레임을 drop하는 것은 실시간 AI에서는 오류가 아니라 지연을 줄이기 위한 선택일 수 있다. 다만 payload는 반드시 실제 처리 프레임 기준이어야 한다.
- bbox 오표시는 모델 문제가 아니라 표시 계층의 단위 정규화 문제일 수 있다.
- Tracking 파라미터를 바꾸기 전에 `fallbackIdRate`, `lost_tracks`, `avgSelectedDeltaMs` 같은 지표를 먼저 봐야 한다.
- 증거 영상 설계에서는 빠른 알림과 지연 생성되는 clip metadata를 분리해야 한다.
- Synthetic Data는 양을 늘리는 일이 아니라 leakage와 과적합을 통제하는 데이터 운영 문제다.

## 11. 최신 업데이트

아래 템플릿에 오늘 작업과 이력서 반영 후보를 계속 누적한다.

| 날짜 | 오늘 작업 | 확인한 증거/파일 | 상태 | 이력서 반영 후보 | 다음 확인 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-06-30 | RTSP latest-frame, evidence chain, overlay sync, tracking, HLS clip 설계, hard negative/synthetic 방향 정리 | `2026-06-30-Overlay-Tracking-Evidence-Log`, tracking/overlay/HLS 설계 문서 | `진행 중`, 일부 `검증 필요`, 일부 `팀원 위임` | "실시간 AI 관제 pipeline에서 frame evidence chain과 overlay 정합성 진단 체계를 정리" | 운영계 E2E 로그에서 `frameId=n/a` 재발 여부 확인 |
| YYYY-MM-DD |  |  | `진행 중` / `검증 필요` / `완료` / `팀원 위임` |  |  |

## 12. 다음 보강할 내용

- 운영계 또는 데모 환경에서 `fallbackIdRate`, `missingBBoxRate`, `trackSwitchCount`, `avgSelectedDeltaMs` 실제 수치 확보.
- `frameId=n/a`, `capturedAtMs=n/a`가 Backend/Frontend handoff에서 완전히 사라졌는지 E2E 로그로 확인.
- 10초 HLS clip 설계의 실제 구현 담당자, 구현 범위, 테스트 결과를 분리해 업데이트. (`팀원 위임`)
- Hard negative mining exporter와 synthetic augmentation manifest가 실제 어떤 파일을 생성하는지 예시 추가. (`진행 중`)
- 이력서 bullet을 AI Engineer, Backend/AI Pipeline, Frontend Realtime UI 직무별로 3종 분리.
- STAR 답변에 실제 수치가 확보되면 Result 항목만 업데이트.

---
#resume #interview #STAR #evidence #trend-2026
