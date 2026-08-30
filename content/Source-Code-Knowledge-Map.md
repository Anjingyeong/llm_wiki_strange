---
title: Source Code Knowledge Map
navTitle: Source Map
shortTitle: Source Map
category: Architecture
relatedDocs: [Architecture, AI-Pipeline, MQTT-Event-Schema, Graphify-Semantic-Map]
relatedFiles: [이상행동/ai, 이상행동/back, 이상행동/front, 이상행동/infra]
updatedAt: 2026-07-28
type: architecture
status: partial
evidenceLevel: code-only
implementation_status: implemented
---

## 목적

`strangeRookies/ai`, `back`, `front`, `infra`의 최신 로컬 체크아웃을 기준으로 실제 구현 위치와 역할을 연결한다. 문서의 설명보다 코드가 우선이며, 검색 답변은 아래 경로를 근거로 구현 상태를 판단한다.

## 분석 기준 리비전

- AI: `c1b5242` (`develop`) — odd camera 강제 chromakey 기본 비활성화
- Backend: `92f10a0` (`develop`) — AI restart 기능 병합 상태
- Frontend: `6b820f9` (`develop`) — 테스트 모드 snapshot 연동
- Infra: `7d4e192` (`main`) — Backend 이미지 태그와 S3 bucket 설정 갱신

Frontend에는 `.env.example`, `scripts/verify-session-persistence-contract.mjs`가 추적되지 않은 상태로 존재하므로, 해당 파일은 운영 기준 근거에서 제외한다.

## End-to-End 책임 경계

```text
RTSP source
  → AI Reader / latest-frame queue
  → YOLO Pose
  → ByteTrack 또는 SimpleTracker fallback
  → per-track sequence / LSTM
  → Fall lifecycle state machine
  → MQTT event·overlay·frame_sync
  → Spring Boot subscriber
  → AlertEvent·Snapshot 저장
  → WebSocket/STOMP broadcast
  → React dashboard
  → 선택적 VLM description·embedding·semantic search
```

## AI 저장소

### 프레임 수집과 지연 제어

- `이상행동/ai/stream/rtsp_reader.py`: RTSP 입력을 전담하는 Reader.
- `이상행동/ai/stream/frame_queue.py`: `LatestFrameQueue`를 제공한다. 제한된 Queue를 사용해 소비가 늦을 때 오래된 프레임을 유지하지 않는 실시간 우선 경로다.
- `이상행동/ai/ai/frame_sync.py`: 카메라별 frame metadata와 queue 상태를 관리한다.

이 구조의 목적은 모든 과거 프레임을 처리하는 것이 아니라 현재 프레임을 빠르게 분석하는 것이다. MQTT payload에는 `capturedAtMs`, `processedAtMs`, `publishedAtMs`, `queueLagMs`, `droppedFrameCount`가 포함될 수 있다.

### 탐지·추적·행동분류

- `이상행동/ai/ai/inference/rtsp_runtime.py`: RTSP 추론 운영 경로와 후처리기 선택을 담당한다.
- 기본 추적 경로는 Supervision ByteTrack이다.
- `tracking_mode=auto`에서 Supervision 후처리가 비활성화되면 lightweight SimpleTracker로 전환한다.
- `이상행동/ai/ai/postprocess/supervision_postprocessor.py`: YOLO detection을 ByteTrack 입력으로 변환하고 track id를 부여한다.
- `이상행동/ai/ai/action/per_track_sequence_buffer.py`: 프레임 단위 pose 결과를 track별 시간 창으로 구성한다. ID 변경 시 IoU·중심점 이동 등을 이용한 relink 보조 로직이 존재한다.

### 저비용 자세 필터와 상태머신

- `rtsp_runtime.py`에서 cheap-filter의 기본 상체 기울기 비율은 `1.3`이다.
- `이상행동/ai/ai/action/faint_post_processing.py`: 연속 감지, 카메라 cooldown, track 상태머신을 결합한다.
- `이상행동/ai/ai/action/fall_event_state.py`: `NORMAL → FALL_CANDIDATE → FALL_CONFIRMED → POST_FALL_LYING → RECOVERED` 생명주기를 관리한다.
- `POST_FALL_LYING`에서는 cooldown이 지났더라도 동일 낙상을 `NEW_FALL`로 다시 발행하지 않는다.
- 장시간 회복하지 않으면 `FAINT_SUSPECTED` 또는 `FALL_UNRECOVERED` 계열 이벤트를 별도로 발행할 수 있다.

상태머신은 단순 cooldown만으로 동일 사고가 반복 알림되는 문제를 막고, 최초 낙상과 장시간 미회복을 구분하기 위해 존재한다.

### TensorRT

- `이상행동/ai/ai/inference/tensorrt_runtime.py`: `.engine` 검증, TensorRT runtime 역직렬화, 실패 사유 반환을 담당한다.
- `이상행동/ai/detector/yolo_pose_detector.py`: TensorRT 생성 실패 또는 실행 실패를 숨기지 않고 실제 backend와 fallback 원인을 출력한다.
- `이상행동/ai/scripts/benchmark_yolo_backends.py`, `compare_tensorrt_candidate.py`: 동일 프레임 기준 PyTorch와 TensorRT 후보를 비교한다.

따라서 TensorRT는 무조건 사용되는 것이 아니라 엔진 검증 후 선택되고, 실패 시 PyTorch 경로로 복구 가능한 구조다.

### MQTT 계약

- `이상행동/ai/ai/publishers/mqtt_payloads.py`: event, overlay, `frame_sync` payload를 생성한다.
- `frame_sync`의 `messageType`과 `type`은 모두 `frame_sync`이며 `streamId`, `cameraLoginId`, `frameId`, timestamp, queue lag, drop count를 포함한다.
- 사고 이벤트에는 sequence metadata, track id, snapshot/clip 경로가 추가될 수 있다.

## Backend 저장소

### MQTT 수신과 이벤트 저장

- `이상행동/back/src/main/java/com/strange/safety/event/MqttSafetyEventSubscriber.java`: MQTT 메시지를 수신하고 DTO 변환 및 비동기 처리 경로로 전달한다.
- `.../alert/service/AlertEventService.java`: 카메라 식별자를 registry에서 해석하고 `AlertEvent`, Snapshot, clip metadata를 저장한다.
- 실시간 이벤트는 recent-alert cache에 추가되고, 증거 보강용 재발행은 별도 처리된다.

하나의 낙상에 대해 즉시 이벤트와 clip 완성 후 이벤트가 다시 들어올 수 있다. `AlertEventService.isAlreadyNotified(eventId)`는 두 번째 메시지에서 WebSocket·FCM 알림이 중복 발생하지 않도록 막는다.

### WebSocket 브로드캐스트

- `이상행동/back/src/main/java/com/strange/safety/event/AlertBroadcastService.java`: 저장된 사고를 STOMP topic으로 전달한다.
- `CameraStatusBroadcastService`, `OverlayBroadcastService`, `SnapshotAssistBroadcastService`가 각각 카메라 상태, overlay, VLM snapshot assist 채널을 담당한다.
- 사용자 scope에 따라 facility 또는 company topic으로 분리된다.

### VLM side channel

- 기본 AlertEvent/Snapshot 저장이 먼저이며 VLM은 선택적 후처리다.
- `AlertEventService.enqueueVlmSideChannel(...)`은 기본 저장 이후 VLM 작업을 연결한다.
- `VlmDescriptionJobWriter`: description job을 기록한다.
- `VlmProcessingScheduler`: 처리 가능한 작업을 주기적으로 claim한다.
- `AlertEventDescriptionRepository`: `PENDING` 또는 lock이 만료된 `PROCESSING`, `nextAttemptAt <= now` 조건을 이용한 재시도 대상을 조회한다.
- `EmbeddingWorker`, `EmbeddingJobClaimService`, `EmbeddingJobCompletionService`: description 생성 후 embedding 단계를 분리한다.
- `SemanticSearchService`: 저장된 description/embedding을 이용한 사고 검색 경로다.

VLM 실패가 실시간 사고 저장을 롤백하지 않도록 side-channel로 분리된 구조다.

## Frontend 저장소

### 실시간 알림

- `이상행동/front/src/hooks/useAlertWebSocket.ts`: `/ws` STOMP 연결과 `/topic/alerts` 구독을 담당하며 재연결 지연은 5초다.
- `src/hooks/useAiEvents.ts`: `SimpleStompClient` 또는 SSE EventSource 경로를 지원하고 오래된 이벤트를 주기적으로 제거한다.
- `src/shared/utils/stomp.ts`: 직접 WebSocket/STOMP 연결을 관리하며 실패 후 3초 뒤 재연결한다.
- 시설/기업 scope는 `/topic/facility/{id}/alerts`, `/topic/company/{id}/alerts`로 분리된다.

### 영상 경로

- `src/features/dashboard/data/cameras.ts`: stream mode와 URL을 환경변수로 결정한다.
- 기본 URL은 WebRTC `http://localhost:8889`, HLS `http://localhost:8888`, MJPEG `http://localhost:8010`이다.
- `WebRtcCameraPlayer.tsx`: WHEP 연결을 시도하고 실패하면 `VITE_STREAM_FALLBACK_ENABLED`에 따라 HLS로 전환한다.
- `overlaySync.ts`: overlay age가 허용 범위를 넘으면 stale overlay로 판단해 화면 적용을 거부한다.

코드에는 WebRTC·HLS·MJPEG가 모두 존재하므로 문서에서 단일 방식만 운영 중이라고 단정하지 않는다. 실제 배포 환경의 `VITE_STREAM_MODE`가 최종 경로를 결정한다.

### 검색과 VLM UI

- `SemanticEventSearchPanel.tsx`, `api/semanticSearch.ts`: 카메라와 자연어 조건을 사용한 사고 검색 UI/API.
- `useVlmSnapshotAssist.ts`, `VlmSnapshotAssistPanel.tsx`: AI 감지 근거 설명을 별도 topic으로 표시한다.

## Infra 저장소

현재 `이상행동/infra/docker-compose.yml`에서 직접 확인되는 로컬 서비스는 다음 두 개다.

- Eclipse Mosquitto 2: TCP `1883`, WebSocket `9001`, pub/sub 기반 health check, `restart: unless-stopped`.
- Redis 7 Alpine: `6379`, AOF 활성화, `PING` health check, `restart: unless-stopped`.

현재 infra 저장소의 compose에는 MediaMTX 서비스가 없다. 따라서 RTSP `8554`, HLS `8888`, WebRTC `8889`를 이 파일이 직접 기동한다고 설명하면 안 된다. 해당 포트는 Frontend 기본값과 별도 MediaMTX 실행 환경에서 사용되는 계약으로 구분한다.

## 구현 상태 판정 규칙

- `implemented`: 실행 코드와 호출 경로가 존재한다.
- `partial`: 코드가 존재하지만 환경변수·외부 서비스·후속 연결이 필요하다.
- `experimental`: 비교 스크립트나 fallback 후보로 존재하며 운영 기본값이 확정되지 않았다.
- `deprecated`: 코드 또는 ADR에서 운영 경로 제외가 명시됐다.
- `planned`: 문서에만 있고 실행 코드가 없다.

## 검색용 핵심 질문

- RTSP queue에서 오래된 프레임은 어떻게 처리되는가?
- ByteTrack 실패 시 어떤 tracker로 전환되는가?
- 동일 낙상 알림은 상태머신과 Backend에서 각각 어떻게 중복 제거되는가?
- `frame_sync` payload에는 어떤 timestamp가 포함되는가?
- VLM 실패가 실시간 AlertEvent 저장에 영향을 주는가?
- WebRTC 연결 실패 시 Frontend의 fallback 경로는 무엇인가?
- 현재 infra compose가 직접 실행하는 서비스는 무엇인가?
