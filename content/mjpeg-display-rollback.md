---
title: "시연 안정성을 위해 WebRTC/HLS에서 MJPEG로 원복한 이유"
navTitle: "MJPEG 표시 원복"
shortTitle: "MJPEG 원복"
slug: "mjpeg-display-rollback"
category: Infra
tags: [MJPEG, WebRTC, HLS, MediaMTX, RTSP, ffmpeg, cameraLoginId, overlay, stale-stream, network-latency, engineering-tradeoff, VLM, RAG]
updatedAt: 2026-07-15
type: decision
status: verified
verifiedAt: 2026-07-15
evidenceLevel: production
canonicalFor: browser-display-transport
supersedes: ADR-001-WebRTC
order: 470
relatedSlugs: [WebRTC-vs-HLS, MJPEG-Display-Port-Normalization, Frame-Matching-Report, Realtime-Camera-Runtime-Stabilization, ADR-001-WebRTC, Frame-Sync-Canonical, ED-Latest-Frame-Queue-Policy, ED-Snapshot-VLM-Side-Channel]
---

# MJPEG Display Rollback Decision

## 1. 결정 요약

본 문서에서는 스마트 안전 관제 시스템의 기본 브라우저 영상 표시 경로를 WebRTC/HLS 중심에서 **MJPEG 중심으로 원복**하기로 한 기술적 의사결정을 정의한다. 

- **변경 요약**: 브라우저 실시간 영상 표시(Browser Display Transport)를 기존 HLS/WebRTC 중심에서 디버깅과 시연 안정성이 높은 MJPEG multipart stream으로 단순화 및 원복한다. WebRTC/HLS 프로토콜은 완전히 폐기한 것이 아니라 fallback 또는 장기 재검토 대상으로 분리한다.
- **AI 분석 정합성 유지**: 이번 변경은 **AI 추론 구조나 백엔드 파이프라인의 변경이 아니다.** 브라우저에 표시되는 전송 구간(Browser display transport)에만 해당된다.
- **유지되는 AI 파이프라인**:
  - RTSP input 스트림 획득
  - YOLO Pose를 활용한 실시간 키포인트 추출
  - ByteTrack 기반의 멀티 객체 추적
  - LSTM action classification을 통한 쓰러짐/이상행동 분류
  - MQTT를 이용한 안전 메타데이터 및 이벤트 발행
  - Spring Boot 백엔드 코어 비즈니스 로직
  - WebSocket 프로토콜 기반의 실시간 프론트엔드 위험 알림 전송 flow

> [!IMPORTANT]
> **핵심 원칙**: “이번 변경은 AI 추론 구조 변경이 아니라, 시연과 운영 중 브라우저 영상 표시를 안정화하기 위한 display transport decision이다.”


### Frame sync·지연·VLM 경계 (흡수 요약)

- **표시만 MJPEG**로 단순화; AI·MQTT·`frameId` 계약은 유지.
- 오래된 RTSP 프레임 폐기: [ED-Latest-Frame-Queue-Policy](ED-Latest-Frame-Queue-Policy.md).
- Overlay·frameId: [Frame-Sync-Canonical](Frame-Sync-Canonical.md).
- VLM/RAG는 실시간 영상 루프가 아닌 사고 후처리: [ED-Snapshot-VLM-Side-Channel](ED-Snapshot-VLM-Side-Channel.md).
---

## 2. 원복 배경

초기 설계 단계에서 초저지연을 위해 도입했던 WebRTC WHEP 및 HLS 프로토콜 구동 시 실제 시연 및 개발 과정에서 다음과 같은 고비용의 실시간성 안정화 한계들이 관측되었다.

1. **WebRTC WHEP 404 및 HLS index.m3u8 404**: 미디어서버인 MediaMTX가 구동 중이더라도, 특정 `cameraLoginId`에 바인딩된 RTSP publisher 세션이 비정상 종료되거나 지연 연결될 때 브라우저 클라이언트가 WHEP / HLS 재생을 시도하면 즉각 404 응답을 반환하여 화면이 검게 멈추는 상황이 빈발했다.
2. **ffmpeg publisher 라이프사이클 불안정**: 하드웨어 가속 인코더(NVENC)나 copy 스트리밍 모드 상에서 ffmpeg publisher 프로세스가 exit code 224 또는 255 등을 뱉으며 주기적으로 예외 종료되거나, 동일한 스트림 경로의 중복 퍼블리셔 인스턴스가 엉키는 현상이 반복되었다.
3. **영상 전송 상태와 AI 분석 상태의 격리**: MediaMTX를 통한 비디오 전송 상태와 AI 분석 데이터 수신 레이어가 격리되어 있어, "동영상 스트림은 죽었으나 기존에 수신된 WebSocket 위험 메타데이터만 둥둥 떠서 나오는" 복합 장기 추적 장애가 발생하여 신속한 디버깅이 저해되었다.
4. **프론트엔드 stale stream 오판**: 화면이 멈출 때 `MJPEG stream not ready`, `HTTP load error`, `[mjpeg-stale] stale detected` 와 같은 stale 경고가 반복되었으며, health polling 실패와 실제 비디오 프레임 stale 상태가 뒤섞여 `<img>` cache-buster 파라미터가 비정상적으로 과다 갱신되는 원인 추적 한계가 존재했다.

---

## 2.1. 개발 환경 제약과 우선순위 재조정

- **안정화 비용의 한계**: WebRTC와 HLS 프로토콜은 기술적으로 매우 우수하지만, 로컬 및 시연 테스트 망의 고유한 네트워크 지연, MediaMTX publisher lifecycle의 가용성 보장 한계, ffmpeg 자동 재시작 로직 및 브라우저 자체 비디오 재생 제약 조건이 복합되어 실시간성 디버깅 비용이 기하급수적으로 증가하였다.
- **Scope Control을 통한 가치 극대화**: 제한된 프로젝트 개발 일정 안에서 불안정한 실시간 스트리밍 재생 경로를 붙잡고 있는 것보다, 시연 시 확실하게 정상 작동을 보증하는 **"끊김 없는 카메라 영상의 안정적 렌더링"**을 MJPEG를 통해 선제 확보하기로 결정했다.
- **리소스 재배정**: 브라우저 표시 transport는 검증된 MJPEG 규격으로 단순화하고, 절약된 개발 리소스를 스마트 관제 시스템의 핵심 가치 영역인 다음 고도화 과제에 전면 재배치한다:
  - 쓰러짐 및 위험 이상행동 탐지 모델의 정밀 성능 개선
  - 수집된 이상 징후 분석 데이터를 이용한 오탐(FP) / 미탐(FN) 상세 요인 정량화 및 디버깅
  - 이벤트 발생 시의 스냅샷 및 증거 프레임(Evidence frame/timestamp chain) 정합성 강화
  - VLM(Visual Language Model)을 결합한 지능형 이벤트 설명 자동 생성
  - RAG(Retrieval-Augmented Generation) 패턴을 이용한 대화형 사고/이벤트 기록 자연어 검색

> [!TIP]
> **전략적 엔지니어링 결정**: “제한된 개발 기간과 로컬/시연 환경의 네트워크 지연, MediaMTX publisher lifecycle 불안정성으로 인해 WebRTC/HLS 기반 실시간 표시 경로를 남은 기간 내에 완전히 안정화하기 어렵다고 판단했다. 따라서 브라우저 표시 경로는 디버깅과 시연 안정성이 높은 MJPEG로 원복하고, 남은 개발 리소스는 이상행동 모델 성능 개선과 VLM/RAG 기반 이벤트 검색 기능 고도화에 집중하기로 결정했다. 이는 단순 기능 축소나 기술 포기가 아니라 프로젝트의 실질적인 사용자 가치를 높이기 위한 전략적 의사결정이다.”

---

## 3. 왜 MJPEG인가

WebRTC/HLS 대비 MJPEG(Multipart HTTP Stream) 방식이 가지는 장점은 다음과 같다.

1. **지도로 증명되는 단순한 표시 경로**: 별도의 WebRTC 시그널링, WHEP 프로토콜 핸들러, HLS 재생기 라이브러리(hls.js) 등이 불필요하다. HTML 기본 태그인 `<img src="...">` 또는 단순 HTTP stream 수신부만으로 실시간 비디오를 간결하게 표시할 수 있다.
2. **Deterministic 포트 매핑 및 디버깅 편의**: 카메라별 AI Worker 구동 포트가 URL에 즉각 매핑되므로, 장애 발생 시 복잡한 중간 미디어서버 분석 없이 `http://localhost:8014/mjpeg/cam_05` 등의 개별 포트에 `curl` 또는 브라우저로 직접 접속하여 비디오 상태를 1초 만에 격리 판정할 수 있다.
3. **AI 추론 및 화면 전송의 일원화**: 분석용 프레임을 추론하는 프로세스(Worker) 자체에서 화면도 함께 Multipart JPEG 스트림으로 인코딩하여 직접 송출하므로, 추론 스냅샷과 표시 화면 사이의 메타데이터 불일치가 원천 봉쇄된다.

---

## 4. MJPEG 포트 및 URL 매핑

동적 카메라 등록 구조를 반영한 카메라별 MJPEG 포팅 및 URL 매핑에 관한 공식 규칙과 테이블은 Canonical 문서인 **[Realtime-Camera-Runtime-Stabilization](Realtime-Camera-Runtime-Stabilization.md)**의 `4.2 RTSP 포트 및 URL 매핑 규칙`을 참고해 주시기 바랍니다.

---

## 5. 유지되는 AI/이벤트 파이프라인

MJPEG 원복은 화면을 그리기 위한 비디오 전송 포맷만을 바꾼 것이며, 카메라 분석 및 위험 보고의 AI 코어 구조는 기존과 같이 동일하게 유지된다.

```text
RTSP 입력
  ↓
AI Worker (YOLO Pose + ByteTrack)
  ↓
LSTM 이상행동 행동 분류 모델
  ↓
MQTT 프로토콜 기반 안전/사고 이벤트 메타데이터 발행
  ↓
Spring Boot 백엔드 관제 서버 수신
  ↓
WebSocket 연결을 통한 관제 프론트엔드 경보 발생
```

- **메타데이터 전송 계약 분리**: capturedAtMs, frameId, LSTM 시퀀스 검증 및 캡처 스냅샷 등 AI 데이터 정합성은 그대로 보존되며, local receive time 한계 등 원본 카메라 촬영 시간과의 정합성은 프레임 일관성 체인을 통해 정교하게 제어된다.

---

## 6. WebRTC/HLS의 현재 위치

HLS/WebRTC는 완전히 폐기된 것이 아니라, 장기 기술 과제 및 가용 조건 충족 시 재도입될 수 있는 예비 모드로 보존된다. 향후 WebRTC/HLS를 메인 display transport로 재활성화하기 위해 충족되어야 하는 기술적 성숙 요건은 다음과 같다.

- MediaMTX publisher 세션 lifecycle의 연결 안정성 확보
- WHEP 404 및 HLS 플레이리스트 404 예외 핸들링을 통한 자동 복구 메커니즘 수립
- ffmpeg 프로세스의 비정상 종료 시 재시작 및 포트 충돌 방지 로직 고도화
- 비디오 프레임의 stale 상태와 헬스 체크 수신 지연 상태의 정밀 구분
- AI 오버레이 렌더링 프레임과 백엔드 위험 알람 사이의 절대 시간 동기화 정합성 확보
- 시연 및 배포 네트워크 환경에서의 대역폭 및 패킷 지연 허용 임계치 검증

---

## 7. 남은 개발 리소스 집중 방향

MJPEG 단순화를 통해 절약된 엔지니어링 에너지는 포트폴리오 관점에서 **완성도 지향의 전략적 스케줄링**으로 환산되며, 다음 태스크들의 고도화에 전폭적으로 투자된다.

1. **이상행동 모델 오탐 개선**: 실환경에서 수집된 False Positive(낙상으로 잘못 진단된 일시적 허리 굽힘 등) 케이스를 분석하여 YOLO Pose 피처 엔지니어링과 LSTM 활성화 파라미터를 미세 튜닝한다.
2. **VLM 기반 시나리오 캡션 생성**: 탐지된 위급 이벤트 프레임을 로컬 VLM에 인입하여 "작업장 3구역에서 인부가 미끄러져 쓰러짐 발생"과 같이 상황을 자연어로 요약하고, RAG 데이터베이스의 메타 태깅 수준을 고도화한다.
3. **RAG/Wiki 이벤트 다차원 검색 구현**: LLM Wiki 및 RAG 시스템을 연계하여 관제 담당자가 "최근 쓰러짐 사고의 발생 시각과 복구 조치는?"과 같이 질문했을 때, 최신 위키 문서와 RAG 벡터 저장소를 결합해 정확한 증거 파일과 해결 내용을 대화형으로 빠르게 검색할 수 있는 기능적 완성도를 창출한다.

---

## 8. 운영 체크리스트

시스템 진단 및 장애 격리 시 다음 체크리스트를 준수한다.

- `http://localhost:<port>/health` 엔드포인트가 정상인지 확인하여 worker 프로세스의 생존 여부를 조회한다.
- `http://localhost:<port>/mjpeg/{cameraLoginId}` 에 curl 요청을 보내 multipart JPEG 바운더리 프레임 바이너리가 계속 유입되는지 스트림 출력을 모니터링한다.
- worker 기동 인수 중 `--no-mjpeg-enable-overlay` 가 삽입되어 실시간 분석 BBox/Pose 오버레이가 비활성화되지 않았는지 환경변수 값을 대조한다.
- 프론트엔드가 과거 HLS/WebRTC 주소(예: 8888, 8889)에 묶여있지 않고 `VITE_STREAM_MODE=mjpeg`로 올바르게 분기하는지 확인한다.
- stale detector가 헬스체크 응답 지연을 비디오 스트림 지연으로 성급하게 판정하지 않도록 오판 차단 상수를 튜닝한다.

---

## 9. 결론 (Portfolio Rationale)

실시간 영상 표시 경로는 초기에는 WebRTC/HLS 기반으로 검토했지만, 제한된 개발 기간과 시연 환경의 네트워크 지연, MediaMTX publisher lifecycle 불안정성으로 인해 안정화 비용이 크다고 판단했습니다. 이에 따라 브라우저 표시 경로는 디버깅과 시연 안정성이 높은 MJPEG로 원복하고, 남은 개발 리소스는 이상행동 모델 성능 개선과 VLM/RAG 기반 이벤트 검색 기능 고도화에 집중했습니다. 이는 단순 기능 축소가 아니라, 제한된 기간 안에서 사용자에게 보여줄 수 있는 핵심 가치와 운영 안정성을 우선한 기술적 의사결정입니다.

MJPEG 원복 결정은 최종 시연 환경에서 안전성 확보를 위한 영리한 엔지니어링 절충안(Trade-off)이며, 핵심 AI 위급 행동 탐지와 메타데이터 분석 파이프라인의 완성도를 극한으로 높이는 디딤돌이 될 것입니다.
