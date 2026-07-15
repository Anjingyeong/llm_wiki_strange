---
title: MJPEG Display Port Normalization
navTitle: "MJPEG 포트"
shortTitle: "MJPEG 포트"
category: Infra
tags: [mjpeg, streaming, cameraLoginId, overlay]
updatedAt: 2026-07-07
relatedFiles: [AI_실행_딸깍.bat, strange_front/src/features/dashboard/data/cameras.ts, strange_front/src/features/dashboard/components/CameraStreamFrame.tsx, strange_front/.env.example, strange_front/Dockerfile, strange_infra/docker-compose.yml, strange_ai/ai/registered_cameras.py, strange_ai/scripts/run_registered_cameras.py, strange_ai/scripts/serve_ai_overlay.py]
---

# MJPEG Display Port Normalization

## Problem

Notifications were arriving, and MJPEG bytes could be fetched, but the browser display path and AI overlay/tracking visualization were inconsistent after the WebRTC/HLS work. The runtime diagnosis showed that current GPU workers could be serving MJPEG while still being launched with `--no-mjpeg-enable-overlay`, which means analysis can run but the JPEG frames do not contain baked AI overlay graphics.

## Before

- Backend camera registration and lookup continued to use the dynamic `cameraLoginId` contract through the camera APIs.
- AI registered camera runner read active cameras, kept RTSP input, and launched per-camera workers.
- MediaMTX RTSP/HLS/WebRTC remained available on the infrastructure side.
- Frontend defaults and Docker build args could still point users toward HLS/WebRTC-oriented display paths.
- MJPEG worker ports could be available, but the frontend/env story did not clearly model a multi-port MJPEG range.
- GPU workers could be launched with `--no-mjpeg-enable-overlay`, causing "image arrives but no visible AI overlay/tracking" symptoms.

## After

- The default frontend stream mode is MJPEG.
- HLS/WebRTC code remains available through `VITE_STREAM_MODE=raw` or `VITE_STREAM_MODE=webrtc`, but it is not the default display path.
- Frontend MJPEG direct mode computes the port from `cameraLoginId` suffix.
- Reverse proxy deployments can set `VITE_MJPEG_PROXY_MODE=true` to keep one public host/port and fan out by path.
- AI runner and standalone MJPEG server default `MJPEG_ENABLE_OVERLAY=true`, while explicit opt-out remains available.
- `AI_실행_딸깍.bat` forwards the configured MJPEG port range so GPU-PC workers can be reached from the web PC.

## Port Mapping & URL Generation

포트 매핑 공식, 상세 매핑 테이블, 그리고 프론트엔드 환경 기본값은 Canonical 문서인 **[Realtime-Camera-Runtime-Stabilization](Realtime-Camera-Runtime-Stabilization.md)**의 `4.2 RTSP 포트 및 URL 매핑 규칙`을 참고해 주시기 바랍니다.

## Backend/API Impact

No backend DTO or camera registration contract change is required. The backend still owns active camera lookup and overlay registry status. The frontend display change depends on `cameraLoginId`, not hard-coded `cam1..cam4` URLs.

## AI Worker and MJPEG Server

Main launcher:

```bat
AI_실행_딸깍.bat
```

AI runner:

```bash
cd strange_ai
python scripts/run_registered_cameras.py --backend-base-url http://localhost:18080 --rtsp-base-url rtsp://localhost:8554
```

Standalone MJPEG worker smoke:

```bash
cd strange_ai
python scripts/serve_ai_overlay.py --camera-id cam_05 --camera-login-id cam_05 --rtsp-url rtsp://localhost:8554/cam_05 --port 8014 --mjpeg-enabled
```

Important runtime flags:

```text
MJPEG_ENABLED=true
MJPEG_ENABLE_OVERLAY=true
MJPEG_PORT=8010
MJPEG_PORT_END=8020
TRACKING_DEBUG=true
POSE_DEBUG=true
POSE_TRACKING_DIAG_JSONL=true
```

## Diagnostics

- `curl -i http://localhost:<port>/health`: confirms worker connection, frame counts, detections, LSTM predictions, and MJPEG frame counts.
- `curl -i --max-time 3 http://localhost:<port>/mjpeg/{cameraLoginId}`: confirms multipart MJPEG response. Use GET, not HEAD.
- Worker logs should include MJPEG config and heartbeat/inference progress. A worker launched with `--no-mjpeg-enable-overlay` can still send images without visible AI overlay.
- If image bytes arrive but overlay/tracking does not appear, check `MJPEG_ENABLE_OVERLAY`, worker launch args, RTSP input health, and detection counters in `/health`.
- If the browser shows HTTP load errors, check SSH port forwarding for the full MJPEG range and verify that the frontend URL port matches the camera suffix.

## Hardcoding Check

The dynamic `cameraLoginId` structure is preserved. The frontend and AI code do not return to fixed `cam1..cam4` display URLs. Numeric suffix IDs continue beyond four cameras by the same formula.

## Rollback

To display WebRTC again:

```text
VITE_STREAM_MODE=webrtc
VITE_WEBRTC_BASE_URL=http://localhost:8889
```

To display HLS/raw again:

```text
VITE_STREAM_MODE=raw
VITE_HLS_BASE_URL=http://localhost:8888
```

To disable baked MJPEG overlay while keeping MJPEG image streaming:

```text
MJPEG_ENABLE_OVERLAY=false
```

or pass `--no-mjpeg-enable-overlay` explicitly.

## Verification

Commands executed:

| Command | Result |
| --- | --- |
| `npm.cmd run test:mjpeg-routing` in `strange_front` | PASS |
| `npx tsc --noEmit` in `strange_front` | PASS |
| `npm.cmd run build` in `strange_front` | PASS, existing Vite large chunk warning only |
| `python -m unittest tests.test_registered_camera_runner.RegisteredCameraRunnerTest.test_registered_camera_runner_defaults_to_mjpeg_overlay_enabled tests.test_registered_camera_runner.RegisteredCameraRunnerTest.test_overlay_command_passes_bounded_mjpeg_demo_settings tests.test_registered_camera_runner.RegisteredCameraRunnerTest.test_overlay_command_can_disable_mjpeg_overlay_explicitly` in `strange_ai` | PASS |
| `python -m py_compile ai/registered_cameras.py scripts/run_registered_cameras.py scripts/serve_ai_overlay.py tests/test_registered_camera_runner.py` in `strange_ai` | PASS |
| `git diff --check` across changed repos/files | PASS |

Manual HTTP QA artifact:

```text
.omo/ulw-loop/evidence/mjpeg-display-http-smoke.txt
```

## Remaining Risks

- Live GPU workers must be restarted or redeployed after code/env changes; already-running processes keep their old launch args.
- If only ports `8010..8016` are forwarded in a local override, cameras beyond `cam_07` need the range extended.
- The repo still contains HLS/WebRTC paths by design. Future changes must keep MJPEG as default unless the stream mode env is intentionally changed.
- Some Python worker files are large and carry broader refactor risk; this change intentionally kept the behavioral patch narrow.

## Live Execution Status (2026-07-07 Verification)

Verification of live running processes on the GPU server and local port forwarding:

### 1. Process and Port Status
- **Stale workers cleaned**: Old workers running on next-free ports were terminated.
- **New workers launched**: Spawners successfully started new workers on normalized port mappings (`cam_02`->`8011`, `cam_03`->`8012`, `cam_04`->`8013`, `cam_05`->`8014`).
- **No `--no-mjpeg-enable-overlay` flag found**: The overlay is baked into the JPEG frames by default.
- **`cam_01` omitted**: No process exists for `cam_01` (and port `8010` is closed on the server) because it is marked inactive or not found in the backend active camera database.

### 2. Smoke Tests (Client Side via SSH Tunnel)
- **Health Checks**:
  - `curl -s http://localhost:8014/health` -> `{"status": "ok", "connected": true, ...}`
- **MJPEG Streams**:
  - `curl -s -m 1 http://localhost:8014/mjpeg/cam_05` -> `Content-Type: multipart/x-mixed-replace; boundary=frame`.

### 3. Frontend & Launcher Settings
- **Frontend Mode**: `VITE_STREAM_MODE=mjpeg` verified in `.env` and `Dockerfile`.
- **Launcher Forwarding**: `AI_실행_딸깍.bat` maps range `8010..8016` statically.
- **Video Non-Display Root Cause**:
  - Previously, the old workers were running on stale next-free ports (e.g. `cam_03` was on port `8010`) while the frontend expected the normalized formula ports (`cam_03` on `8012`), causing a port mismatch.
  - Restarting the GPU server processes with the normalized port allocation code successfully resolved this issue.


## MJPEG Stream & Frontend Normalization (2026-07-07 Verification Phase 2)

### 1. Problem Symptom
- Although the backend was streaming frames and health checks were operational, the browser-side React dashboard only loaded the very first frame of the MJPEG stream and remained frozen on a single static image.

### 2. Root Cause
- **HTTP/1.0 Protocol Defaults**: The HTTP server in `overlay_http.py` used the default Python `HTTP/1.0` protocol without an explicit `Connection: keep-alive` header. This led the browser parser to handle the response as a single static image resource or close/interrupt the reading loop prematurely.
- **Browser Aggressive Caching**: Browsers cache static image assets eagerly. Without a unique cache-busting query parameter during mount/initial connection, the browser would resolve the stream from cache, stopping continuous frame updates.

### 3. Resolution Details
- **Backend persistent upgrade**:
  - Configured `OverlayHandler` to use `protocol_version = "HTTP/1.1"`.
  - Added explicit `Connection: keep-alive` to response headers in the `stream()` handler.
  - Implemented `last_mjpeg_sent_at` in the `OverlayState` status summary.
- **Worker Heartbeat Logs**:
  - Enhanced `[heartbeat-inference]` logs to output `mjpeg_frame_count`, `last_mjpeg_sent_at`, `last_frame_age_ms`, `stream_clients`, and `overlay_enabled`.
- **Frontend cache-busting & diagnostics**:
  - Enhanced `CameraStreamFrame.tsx` (`MjpegStream` component) to append a mount-scoped timestamp parameter `?t={cacheBuster}` to break browser cache while preventing URL changes on every frame render.
  - Added a 5-second interval console logging routine that monitors `img.complete` status and sizes (`naturalWidth`, `naturalHeight`).
  - Strengthened `onError` UI callback to output the camera ID, stream URL, expected port, and error timestamp.

### 4. Verification Results
- **Unit Tests**:
  - Running `python -m unittest tests/test_mjpeg_overlay_http.py` passes successfully, validating that the connection returns `HTTP/1.1`, contains `Connection: keep-alive`, and streams multiple `--frame` boundaries.
  - Running `npm.cmd run test:mjpeg-routing` in `strange_front` passes successfully.
  - Frontend typecheck and production build pass without errors.
- **Curl Boundary Smoke Capture**:
  - Capturing 3 seconds of the stream: `curl.exe -i --max-time 3 http://localhost:8014/mjpeg/cam_05 > mjpeg_smoke_new.txt`
  - Headers:
    ```text
    HTTP/1.1 200 OK
    Server: BaseHTTP/0.6 Python/3.12.3
    Date: Tue, 07 Jul 2026 02:18:59 GMT
    Content-Type: multipart/x-mixed-replace; boundary=frame
    Connection: keep-alive
    Cache-Control: no-cache, no-store, must-revalidate
    Pragma: no-cache
    Access-Control-Allow-Origin: *
    ```
  - Boundary counts: 24 boundaries parsed in 3 seconds, confirming persistent streaming of images.


