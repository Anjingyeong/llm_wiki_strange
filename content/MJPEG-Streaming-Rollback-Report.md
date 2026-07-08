---
title: MJPEG Streaming Rollback Report
category: Infra
tags: [mjpeg, streaming, cameraLoginId, rollback]
updatedAt: 2026-07-08
relatedDocs: [mjpeg-display-rollback, webrtc-vs-hls]
relatedFiles: [strange_front/src/features/dashboard/data/cameras.ts, strange_front/src/features/dashboard/components/CameraStreamFrame.tsx, strange_ai/scripts/run_registered_cameras.py, strange_ai/ai/overlay_ports.py, strange_ai/ai/registered_camera_workers.py, strange_ai/scripts/serve_ai_overlay.py, strange_back/src/main/java/com/strange/safety/camera/controller/CameraController.java, strange_back/src/main/java/com/strange/safety/camera/overlay/AiOverlayController.java]
---

# MJPEG Streaming Rollback Report

## Summary

웹 관제 화면의 기본 영상 표시 경로를 HLS/WebRTC 중심에서 MJPEG로 되돌렸다. RTSP 입력, MediaMTX, MQTT, WebSocket, HLS/WebRTC 코드는 삭제하지 않고 보존했다. 변경 후 기본 웹 표시 URL은 cameraLoginId 숫자 suffix를 기준으로 포트를 계산한다.

예시:

| cameraLoginId | MJPEG URL |
| --- | --- |
| `cam_01` | `http://localhost:8010/mjpeg/cam_01` |
| `cam_02` | `http://localhost:8011/mjpeg/cam_02` |
| `cam_03` | `http://localhost:8012/mjpeg/cam_03` |
| `cam_04` | `http://localhost:8013/mjpeg/cam_04` |
| `cam_05` | `http://localhost:8014/mjpeg/cam_05` |

## Before

- Backend camera API는 `/api/cameras`, `/api/cameras/active`에서 `cameraLoginId`, `rtspUrl`, `aiEnabled`, `sourceType`, `assignedVideoPath`, ROI 설정을 내려준다.
- AI registered runner는 `/api/cameras/active`를 조회하고 `cameraLoginId`별 worker를 실행한다.
- RTSP 입력은 유지된다. `REAL_RTSP`는 backend의 `rtspUrl`, `SIMULATED_RTSP`는 `rtsp://<host>:8554/{cameraLoginId}`로 MediaMTX에 publish한다.
- MediaMTX는 RTSP `8554`, HLS `8888`, WebRTC/WHEP `8889` 경로를 제공한다.
- Frontend Docker build args가 `VITE_STREAM_MODE=webrtc`를 기본값으로 강제하고 있었다.
- Frontend 코드의 기본 `STREAM_MODE`는 `overlay`였지만, `getDynamicStreamUrl()`이 overlay 모드에서 빈 문자열을 반환해 active camera가 offline처럼 보일 수 있었다.
- AI MJPEG server는 `serve_ai_overlay.py --mjpeg-enabled` 또는 `--mjpeg-debug`일 때 `/mjpeg/{cameraLoginId}`를 열 수 있었지만, registered runner의 기본값은 `MJPEG_ENABLED=false`였다.
- 기존 worker 포트 선택은 실행 중인 worker 기준 next-free 방식이라 `cam_05 -> 8014` 같은 deterministic contract를 보장하지 않았다.

## After

- Frontend default `STREAM_MODE`는 `mjpeg`다.
- Main dashboard, user dashboard, and integrated/admin selected-space camera surfaces now use shared `getDynamicStreamUrl(cameraLoginId)` routing instead of constructing HLS/raw URLs directly.
- Infra compose frontend build arg 기본값도 `VITE_STREAM_MODE=mjpeg`로 바꾸고 `VITE_MJPEG_BASE_URL`을 추가했다.
- Root `.env.example`, `strange_front/.env.example`, `strange_front/Dockerfile`에 `VITE_STREAM_MODE=mjpeg`, `VITE_MJPEG_BASE_URL=http://localhost:8010`을 반영했다.
- `strange_front/.env`는 이미 `VITE_STREAM_MODE=mjpeg`, `VITE_MJPEG_BASE_URL=http://localhost:8010`, `VITE_OVERLAY_BASE_URL=http://localhost:8010` 값으로 설정되어 있었다.
- AI registered runner는 기본적으로 `MJPEG_ENABLED=true`로 worker를 실행한다.
- AI worker port는 `cameraLoginId`의 trailing number 기준으로 계산한다.
- HLS/WebRTC 코드는 남아 있으며, `VITE_STREAM_MODE=webrtc` 또는 `raw`로 되돌릴 수 있다.

## Port Mapping

기본 base port는 `8010`이다. 규칙은 `MJPEG_PORT + numericSuffix(cameraLoginId) - 1`이다.

| cameraLoginId | port |
| --- | ---: |
| `cam_01` | `8010` |
| `cam_02` | `8011` |
| `cam_03` | `8012` |
| `cam_04` | `8013` |
| `cam_05` | `8014` |
| `cam_12` | `8021` |

숫자 suffix가 없는 cameraLoginId는 기존 next-free allocator fallback을 사용한다. 운영 표준 카메라 ID는 `cam_01`, `cam_02`처럼 suffix가 있는 형태를 권장한다.

## Frontend URL Generation

Frontend는 `VITE_MJPEG_BASE_URL` 기본값 `http://localhost:8010`을 기준으로 URL을 만든다.

```text
http://<host>:<8010 + camera suffix - 1>/mjpeg/{cameraLoginId}
```

개발 환경은 localhost를 기본값으로 둔다. 배포 환경은 `VITE_MJPEG_BASE_URL`로 host를 분리한다. HLS/WebRTC host는 각각 `VITE_HLS_BASE_URL`, `VITE_WEBRTC_BASE_URL`로 보존한다.

Frontend env baseline:

```text
VITE_STREAM_MODE=mjpeg
VITE_MJPEG_BASE_URL=http://localhost:8010
VITE_OVERLAY_BASE_URL=http://localhost:8010
VITE_WEBRTC_BASE_URL=http://localhost:8889
VITE_HLS_BASE_URL=http://localhost:8888
VITE_STREAM_FALLBACK_ENABLED=true
```

## Backend/API Impact

Backend camera 등록/조회 DTO와 `/api/cameras/active` 계약은 변경하지 않았다. AI overlay registry API도 그대로 유지한다.

- `/api/cameras/active`: AI runner가 active camera 목록을 읽는다.
- `/api/cameras/{cameraLoginId}/ai-overlay`: backend registry 상태 조회.
- `/api/internal/ai-overlays/report`: AI worker가 MJPEG URL, port, PID, status를 보고한다.

이번 롤백은 웹 표시 경로와 AI worker 포트 선택을 바꾼 것이며 backend DTO 필드 변경은 없다.

## Required Runtime Commands

기반 서비스:

```bash
docker compose -f strange_infra/docker-compose.yml up -d
```

Backend:

```bash
cd strange_back
./gradlew bootRun
```

AI registered camera runner:

```bash
cd strange_ai
python scripts/run_registered_cameras.py \
  --backend-base-url http://localhost:18080 \
  --rtsp-base-url rtsp://localhost:8554
```

Frontend dev:

```bash
cd strange_front
npm install
npm run dev
```

Standalone MJPEG worker smoke:

```bash
cd strange_ai
python scripts/serve_ai_overlay.py \
  --camera-id cam_05 \
  --camera-login-id cam_05 \
  --rtsp-url rtsp://localhost:8554/cam_05 \
  --port 8014 \
  --mjpeg-enabled
```

## Diagnostics

MJPEG stream not ready 또는 HTTP load error를 볼 때 확인할 것:

- Frontend URL: `http://localhost:8014/mjpeg/cam_05`처럼 cameraLoginId suffix와 port가 맞는지 확인한다.
- Worker log: `runs/registered_cameras/{cameraLoginId}-overlay.log`에서 `[mjpeg-config]`, `[heartbeat-inference]`, `[ai-worker]` 로그를 확인한다.
- Health endpoint: `curl -i http://localhost:<port>/health`.
- Stream endpoint: `curl -i --max-time 2 http://localhost:<port>/mjpeg/{cameraLoginId}`.
- Backend active camera API: `curl -i http://localhost:18080/api/cameras/active`.
- MediaMTX RTSP 입력: `rtsp://localhost:8554/{cameraLoginId}` publisher가 살아 있는지 확인한다.
- GPU/CPU 부족 시 worker exit 로그, RTSP probe failure, queue drop count, heartbeat 지연을 먼저 본다.

## Hardcoding Check

카메라 개수는 4개로 제한하지 않았다. 포트 계산은 숫자 suffix 기반이라 `cam_12 -> 8021`까지 같은 규칙으로 증가한다. `cam1`~`cam4` 고정 URL로 되돌리지 않았다.

## Rollback

WebRTC 기본 표시로 되돌리려면 다음 설정만 바꾼다.

```text
VITE_STREAM_MODE=webrtc
VITE_WEBRTC_BASE_URL=http://localhost:8889
VITE_HLS_BASE_URL=http://localhost:8888
```

HLS raw 표시로 되돌리려면:

```text
VITE_STREAM_MODE=raw
VITE_HLS_BASE_URL=http://localhost:8888
```

AI worker의 MJPEG server를 끄려면:

```text
MJPEG_ENABLED=false
```

## Verification

RED to GREEN:

| Check | RED | GREEN |
| --- | --- | --- |
| AI port mapping test | `ImportError: cannot import name 'overlay_port_for_camera_login_id'` | `python -m unittest ...test_overlay_port_is_derived_from_camera_login_id_suffix` passed |
| AI MJPEG default test | `AssertionError: False is not true` | `python -m unittest ...test_parse_args_defaults_to_sequence_30_stride_15` passed |
| Frontend MJPEG routing | stale script failed with `CameraStreamFrame must resolve backend ai-overlay registry URLs...` | `npm.cmd run test:mjpeg-routing` passed |

Commands run:

| Command | Result |
| --- | --- |
| `npm.cmd run test:mjpeg-routing` in `strange_front` | PASS |
| `npm.cmd run typecheck` in `strange_front` | PASS |
| `npm.cmd run build` in `strange_front` | PASS, with existing Vite large chunk warning |
| Re-run after frontend env/Dockerfile updates: `npm.cmd run test:mjpeg-routing`, `npm.cmd run typecheck`, `npm.cmd run build` | PASS, same existing Vite large chunk warning |
| Re-run after fixing `IntegratedDashboard` HLS/raw bypass: `npm.cmd run test:mjpeg-routing`, `npm.cmd run typecheck`, `npm.cmd run build` | PASS, same existing Vite large chunk warning |
| `python -m unittest tests.test_registered_camera_runner tests.test_registered_camera_docker_config tests.test_mjpeg_overlay_http tests.test_mjpeg_debug_mode` in `strange_ai` | PASS, 39 tests |
| `python -m unittest tests.test_mjpeg_overlay_http.MjpegOverlayHttpTest.test_mjpeg_camera_path_streams_multipart_jpeg` in `strange_ai` | PASS |
| `./gradlew.bat test` in `strange_back` | PASS |

Manual HTTP QA:

- Artifact: `.omo/ulw-loop/019f39df-9075-7d73-bb89-858c58d774ee/evidence/mjpeg-http-manual-qa.txt`
- Started a temporary MJPEG server for `cam_05` on `127.0.0.1:8014`.
- `curl.exe -i http://127.0.0.1:8014/health` returned `HTTP/1.0 200 OK` and `connected=true`.
- `curl.exe -i --max-time 2 http://127.0.0.1:8014/mjpeg/cam_05` returned `HTTP/1.0 200 OK`, `Content-Type: multipart/x-mixed-replace; boundary=frame`, and JPEG frame bytes.
- Cleanup verified: background job removed and port `8014` closed.

## Remaining Risks

- `PROJECT_CONTRACT.md` still documents HLS as the frontend view URL contract. This report records the rollback, but a formal contract revision should be coordinated with all agents before editing that read-only contract.
- Numeric suffix mapping is deterministic for IDs like `cam_01`. Non-numeric IDs fall back to next-free allocation.
- MJPEG uses one HTTP stream per client and can cost CPU if many clients watch the same camera. Keep `MJPEG_FPS`, width, height, and JPEG quality bounded.
- If RTSP input is unavailable, the MJPEG server can answer health but video will show placeholder/not-ready behavior until frames arrive.
- WebRTC/HLS code is preserved and can still be selected by env, but the default is now MJPEG.
