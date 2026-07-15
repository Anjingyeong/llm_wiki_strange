---
title: 실시간 카메라 송출 안정화 및 비디오 라이프사이클 관리
navTitle: "카메라 안정화"
shortTitle: "카메라 안정화"
category: Bugs
summary: "active camera 과다 실행이 불안정 원인. allowlist 제한, cameraLoginId 및 등록 목록 기반 동적 할당, 그리고 session_reset_reason 기반 비디오 바운더리 초기화 규격."
tags: [bugs, camera-runtime, active-camera, allowlist, webrtc, mediamtx, ffmpeg, cameraLoginId, dynamic-camera-registry, video-boundary]
entities: [cameraLoginId, active camera, allowlist, cam_01, cam_04, MediaMTX]
relatedDocs: [Architecture, WebRTC-vs-HLS, Bug-RTSP-Stream-404, AI-Pipeline, Multi-Camera-Worker-Session-Reliability]
relatedFiles: [strange_ai/scripts/start_simulated_rtsp_from_folder.py, strange_ai/scripts/run_registered_cameras.py, strange_ai/scripts/start_ai_stable.sh, AI_실행_딸깍.bat]
updatedAt: 2026-07-14
---

## 1. 문제 정의

실시간 다중 채널 CCTV 관제 시스템에서 RTSP 카메라 스트림의 일시 단절 및 재연결(Reconnect), 프레임 누락(Dropped Frames), 중복 simulated publisher 생성 등으로 인해 비디오 스트리밍이 멈추거나 CPU 사용률이 폭증하는 장애가 발생했습니다.
특히 트래커 및 AI 시퀀스 분석 엔진이 스트림 단절 상태를 감지하지 못하고 이전 객체 ID를 억지로 매칭 유지하려 하여 잘못된 이상행동 오발람을 발송하는 라이프사이클 무너짐 현상이 관찰되었습니다.

## 2. 실제 관찰 및 원인

- **중복 simulated publisher**: `start_simulated_rtsp_from_folder.py` 프로세스가 NVENC 및 auto 모드로 중복 실행되면서 동일 MediaMTX RTSP 경로에 프레임을 번갈아 공급하여 프레임 타임스탬프가 역전되는 현상이 발견되었습니다.
- **active camera 과다**: smoke test 범위인 `cam_01`~`cam_04`를 초과하여 DB에 등록된 모든 ACTIVE 카메라에 대해 ffmpeg 및 AI worker가 구동되면서 리소스 고갈 및 포트 충돌이 생겼습니다.
- **스트림 불연속 유실**: 스트림이 단절되었다 복구되는 시점에 프레임 격차(Frame gap)와 시간 간격(Time gap)이 크게 벌어졌음에도 트래커가 초기화되지 않고 구형 가림 대상의 ID를 마이그레이션하려다 상태가 왜곡되었습니다.

## 3. 내가 한 판단

- **cameraLoginId 기반 동적 할당**: 임의의 임시 경로 대신 DB 등록 목록 및 `cameraLoginId` 식별자에 1대1 매핑된 Dynamic Port 구조를 정립하였습니다.
- **엄격한 스트림 제한(RTSP/MJPEG)**: MJPEG 스트리밍 송출로 인한 CPU 점유율을 억제하기 위해 해상도 640x480, 15 FPS 제한, JPEG quality 70 옵션을 표준화하고 `latest-frame` 큐 버퍼 정책으로 느린 클라이언트 에이전트의 프레임을 드롭하였습니다.
- **비디오 경계 초기화(Video Boundary Reset) 규격 도입**: 시간적 단절 상황을 프레임 간 격차로 정량 판단하여, 임계치를 넘을 경우 트래커와 Sequence Buffer를 즉시 리셋하는 자가 복구 메커니즘을 정의하였습니다.

## 4. 구현 및 검증

현재 develop 런타임 코드(`ai/inference/session_boundary.py` 및 `serve_ai_overlay.py`)에 카메라 매핑 정책 및 세션 경계 리셋 조건이 구현 완료되어 실전에 가동되고 있습니다.

### 4.1 카메라 동적 할당 및 MJPEG 압축 사양
- **카메라 식별자**: `cameraLoginId` 기준 포트 라우팅 및 1대1 분할 프로세스 구동.
- **MJPEG 스트림 경량화 기본값**:
  - `stream_fps`: 15 FPS
  - `output_width`: 640
  - `jpeg_quality`: 70
  - `latest-frame` 우선 정책 활성화 (느린 AI 루프와 Client 분리)

### 4.2 RTSP 포트 및 URL 매핑 규칙 (Canonical)

등록된 active camera 목록을 토대로 `cameraLoginId` 숫자 suffix를 추출하여 Deterministic 포트를 계산합니다.
숫자 suffix가 없는 cameraLoginId는 기존 next-free allocator fallback을 사용합니다. 운영 표준 카메라 ID는 `cam_01`, `cam_02`처럼 suffix가 있는 형태를 권장합니다.

- **포트 계산 공식**: `port = 8010 + numericSuffix(cameraLoginId) - 1`
- **URL 규칙**: `url = http://<host>:<port>/mjpeg/{cameraLoginId}`

| cameraLoginId | 계산식 | 포트 | URL 예시 |
| :--- | :---: | :---: | :--- |
| `cam_01` | 8010 + 1 - 1 | `8010` | `http://localhost:8010/mjpeg/cam_01` |
| `cam_02` | 8010 + 2 - 1 | `8011` | `http://localhost:8011/mjpeg/cam_02` |
| `cam_03` | 8010 + 3 - 1 | `8012` | `http://localhost:8012/mjpeg/cam_03` |
| `cam_04` | 8010 + 4 - 1 | `8013` | `http://localhost:8013/mjpeg/cam_04` |
| `cam_05` | 8010 + 5 - 1 | `8014` | `http://localhost:8014/mjpeg/cam_05` |
| `cam_12` | 8010 + 12 - 1 | `8021` | `http://localhost:8021/mjpeg/cam_12` |

#### 프론트엔드 환경 기본값 (Direct Mode)
```text
VITE_STREAM_MODE=mjpeg
VITE_MJPEG_BASE_URL=http://localhost:8010
VITE_MJPEG_PORT_END=8020
VITE_MJPEG_BASE_PATH=/mjpeg
VITE_MJPEG_PROXY_MODE=false
```

#### 배포 프록시 환경 (Proxy Mode)
```text
VITE_STREAM_MODE=mjpeg
VITE_MJPEG_BASE_URL=https://<public-stream-host>
VITE_MJPEG_BASE_PATH=/mjpeg
VITE_MJPEG_PROXY_MODE=true
```

### 4.3 비디오 경계 리셋 판단 기준 (`session_boundary.py`)
`session_reset_reason()` 함수는 이전 프레임과 현재 유입 프레임의 메타데이터를 비교하여 다음 기준 충족 시 즉각 세션 리셋을 의사결정합니다.

| 리셋 트리거 사유 | 탐지 조건 | 런타임 조치 |
| :--- | :--- | :--- |
| **`FRAME_ID_RESET`** | `current_frame_id - previous_frame_id < 0` (프레임 번호 역전) | 트래커 인스턴스 재생성 및 Sequence Buffer 초기화 |
| **`LARGE_FRAME_GAP`** | `current_frame_id - previous_frame_id > 90` (90프레임 이상 누락) | 트래커 인스턴스 재생성 및 Sequence Buffer 초기화 |
| **`LARGE_TIME_GAP`** | `current_captured_at_ms - previous_captured_at_ms > 3000` (3초 초과) | 트래커 인스턴스 재생성 및 Sequence Buffer 초기화 |

> [!IMPORTANT]
> 스트림 재연결(Reconnect)이나 비디오 재생 종료(EOF) 상황에서 이 자가 복구 조건이 활성화되어, 트래커의 잘못된 이월(migration)이나 관절 노이즈에 의한 오작동을 원천 방지합니다.

### 4.4 리셋 의사결정 로그
세션 리셋이 결정되면 `log_tracker_reset_decision()`이 호출되어 다음 항목을 실시간 로깅합니다.
- `cameraLoginId`, `frameId`, `capturedAtMs`
- `reason` (FRAME_ID_RESET / LARGE_FRAME_GAP / LARGE_TIME_GAP)
- 트래커 인스턴스 해시 ID (`tracker_object_id`)

---

## 5. 한계 및 후속 작업

### 한계
- HLS/WebRTC 송출로 전면 전환하는 것보다 경량 MJPEG가 기간 내 데모 안정성에 유리하여 우선 채택되었으나, 장기적으로 브라우저 4채널 동시 MJPEG 디코딩은 CPU 소모 문제를 안고 있습니다.

### 후속 작업
- **WebRTC/GStreamer 후속 이식**: MJPEG 송출 병목을 원천 해결하기 위해 GStreamer 기반 WebRTC DataChannel 동기화 구조 개발 (현재 미완료/후속 과제).
- **source FPS 자동 반영**: RTSP 스트림 메타데이터로부터 FPS 정보를 동적 추출하여 LSTM stride에 연동하는 자동화 기능 개발.

---
#troubleshooting #webrtc #hls #mediamtx #ffmpeg #camera-limit #bbox #runtime-stability #video-boundary
