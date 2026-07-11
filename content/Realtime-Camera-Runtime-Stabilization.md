---
title: 실시간 카메라 송출 안정화 및 카메라 수 제한 판단 기록
navTitle: "카메라 안정화"
shortTitle: "카메라 안정화"
category: Bugs
summary: "active camera 과다 실행이 불안정 원인. smoke는 cam_01~04 allowlist로 제한하되 프로덕션 전체 ACTIVE를 코드에 하드코딩하지 않는다. cameraLoginId·등록 목록 기반 실행."
tags: [bugs, camera-runtime, active-camera, allowlist, webrtc, mediamtx, ffmpeg, cameraLoginId, dynamic-camera-registry]
entities: [cameraLoginId, active camera, allowlist, cam_01, cam_04, MediaMTX]
relatedDocs: [Architecture, WebRTC-vs-HLS, Bug-RTSP-Stream-404, AI-Pipeline, Multi-Camera-Worker-Session-Reliability]
relatedFiles: [strange_ai/scripts/start_simulated_rtsp_from_folder.py, strange_ai/scripts/run_registered_cameras.py, strange_ai/scripts/start_ai_stable.sh, AI_실행_딸깍.bat]
updatedAt: 2026-07-01
---

## 목적

실시간 카메라 송출, WebRTC/HLS 재생, AI bbox overlay 안정화 과정에서 확인한 장애 패턴과 운영 판단을 기록한다. 이 문서는 단순 일지가 아니라 같은 문제가 다시 발생했을 때 원인을 빠르게 좁히기 위한 Troubleshooting Wiki다.

핵심 결론은 프론트엔드 WebRTC fallback 자체가 근본 원인이 아니라는 점이다. WebRTC의 `framesDecoded` 정지는 MediaMTX path와 ffmpeg publisher, AI worker가 과도하게 생성되거나 충돌하면서 upstream 영상 공급이 흔들린 결과로 해석해야 한다.

## 최초 증상

프론트엔드에서 여러 카메라가 WebRTC 재생을 유지하지 못하고 HLS로 fallback했다.

```text
[WebRTC Player] Falling back to HLS for cam_05. Reason: WebRTC stream frozen (framesDecoded is not increasing)
[WebRTC Player] Falling back to HLS for cam_04. Reason: WebRTC stream frozen (framesDecoded is not increasing)
[WebRTC Player] Falling back to HLS for cam_02. Reason: WebRTC stream frozen (framesDecoded is not increasing)
[WebRTC Player] Falling back to HLS for cam_03. Reason: WebRTC stream frozen (framesDecoded is not increasing)
```

확인된 의미:

- WebRTC 연결 여부만으로는 성공을 판단할 수 없다. `framesDecoded`가 증가해야 실제 영상 frame이 브라우저까지 도달한 것이다.
- HLS fallback은 프론트엔드 player의 방어 동작이다.
- 같은 시점에 여러 camera path가 동시에 얼었다면 player 단독 문제보다 upstream publisher 또는 MediaMTX path 충돌 가능성이 높다.

## 조사한 원인 후보

초기에는 다음 가능성을 순서대로 확인했다.

- Frontend WebRTC player freeze 감지 로직 문제
- HLS fallback 경로 문제
- MediaMTX HLS/WebRTC path 문제
- ffmpeg publisher 문제
- NVENC encoder 실패
- copy mode 비호환
- 중복 publisher 문제
- active camera 과다 실행 문제
- AI worker 과다 실행 및 port 충돌 문제
- GPU/CPU 자원 부족 문제

## 확인된 사실 1: 중복 simulated publisher

`start_simulated_rtsp_from_folder.py`가 두 개 동시에 실행 중인 상태가 확인됐다.

```text
python scripts/start_simulated_rtsp_from_folder.py ... --ffmpeg-mode nvenc
python scripts/start_simulated_rtsp_from_folder.py ... --ffmpeg-mode auto
```

해석:

- 이전 NVENC 실행 프로세스가 남아 있는 상태에서 auto 실행이 추가됐다.
- 동일 MediaMTX RTSP path에 여러 publisher가 붙을 수 있는 위험 상태였다.
- 이 상태에서는 ffmpeg process와 MediaMTX path가 계속 흔들리며 WebRTC/HLS가 정상이어도 frame 공급이 끊길 수 있다.

## 확인된 사실 2: active camera 과다 실행

Backend `/api/cameras/active` 기준으로 smoke test 대상보다 훨씬 많은 카메라가 활성 목록에 포함돼 있었다.

```text
cam_01
cam_02
cam_03
cam_04
cam_05
cam_06
cam_07
cam_08
cam_10
cam_11
sge
asd
```

해석:

- 의도는 `cam_01`부터 `cam_04` 정도의 제한된 smoke test였지만, 실제 실행 범위는 전체 ACTIVE camera였다.
- 그 결과 ffmpeg publisher, MediaMTX path, AI worker, WebRTC/HLS stream, bbox overlay 대상이 모두 과도하게 늘었다.
- 기능 검증용 smoke test와 전체 운영 모드는 분리해야 한다.

## 확인된 사실 3: ffmpeg mode 전환만으로는 부족

초기에는 `--ffmpeg-mode nvenc`에서 exit code 255가 발생해 `auto` 또는 `copy` 전환을 검토했다. 하지만 copy mode에서도 반복 종료가 확인됐다.

```text
ffmpeg for camera=cam_05 exited with code 255 in mode 'copy'. Restarting.
ffmpeg for camera=cam_02 exited with code 224 in mode 'copy'. Restarting.
ffmpeg for camera=cam_07 exited with code 255 in mode 'copy'. Restarting.
ffmpeg for camera=cam_04 exited with code 255 in mode 'copy'. Restarting.
ffmpeg for camera=cam_03 exited with code 224 in mode 'copy'. Restarting.
```

해석:

- 문제는 NVENC 단독 실패가 아니다.
- copy mode도 입력/출력 조건, 기존 publisher 충돌, active camera 과다 실행, 자원 압박이 겹치면 안정적이지 않다.
- ffmpeg mode 개선보다 먼저 실행 camera 수와 process 중복을 제어해야 한다.

## 확인된 사실 4: MediaMTX publisher 충돌

MediaMTX 로그에서 동일 path의 기존 publisher가 닫히는 패턴이 확인됐다.

```text
[path cam_05] closing existing publisher
[path cam_02] closing existing publisher
[path cam_07] closing existing publisher
```

해석:

- 같은 RTSP path에 새 publisher가 들어오면서 기존 publisher가 교체되고 있었다.
- 이 순간 WebRTC client는 연결되어 있어도 중간 frame 공급이 멈출 수 있다.
- 프론트엔드의 `framesDecoded is not increasing`은 이 upstream 흔들림의 결과로 봐야 한다.

## 확인된 사실 5: AI worker 과다 실행 및 port 충돌 위험

`serve_ai_overlay.py`도 기대한 4개보다 많은 camera에 대해 실행될 수 있는 상태였다.

```text
cam_01
cam_02
cam_03
cam_04
cam_05
cam_06
cam_07
cam_08
cam_10
cam_11
sge
asd
```

port 충돌 위험 예시도 있었다.

```text
cam_04와 cam_08이 같은 port 8012 사용
cam_02와 cam_05가 같은 port 8010 사용
cam_03과 asd가 같은 port 8013 사용
```

해석:

- AI worker가 전체 ACTIVE camera를 대상으로 뜨면 process 수가 급격히 늘어난다.
- camera 수가 늘수록 CPU, GPU, 메모리, port, RTSP connection, WebRTC/HLS 변환 부담이 동시에 증가한다.
- cameraLoginId와 port 모두 중복 방지가 필요하다.

## cleanup 이후 정상 정리 상태

정리 직후에는 AI 관련 publisher, runner, worker, ffmpeg가 남지 않은 상태를 정상 기준으로 잡았다.

```text
start_simulated_rtsp_from_folder.py: 없음
run_registered_cameras.py: 없음
serve_ai_overlay.py: 없음
ffmpeg: 없음
defunct / zombie: 없음
```

남아 있어도 정상인 infra process:

```text
MediaMTX: 실행 중
Mosquitto: 실행 중
18080 tunnel: 열려 있음
8554 / 8888 / 8889 / 8189: MediaMTX port 열려 있음
1883: Mosquitto port 열려 있음
```

운영 해석:

- MediaMTX와 Mosquitto는 기반 서비스이므로 남아 있어도 정상이다.
- `strange_ai` publisher, runner, worker, ffmpeg가 남아 있으면 다음 smoke test에서 중복 실행으로 이어질 수 있다.
- 재실행 전 cleanup 상태를 먼저 확인해야 한다.

## GPU/CPU 자원 상태

cleanup 전후 점검에서 GPU 자원도 이미 다른 작업에 사용 중인 상태가 확인됐다.

```text
GPU-Util: 100%
Memory-Usage: 약 11GB 이상
forenShield-ai 관련 python 프로세스가 GPU 사용 중
```

해석:

- GPU가 이미 포화 상태라면 strange_ai real inference를 동시에 올렸을 때 지연, frame drop, worker stall 가능성이 커진다.
- 영상 송출 안정성 검증과 AI bbox overlay 검증은 분리하는 편이 안전하다.
- 영상 publisher만 확인할 때와 YOLO/LSTM worker까지 확인할 때의 성공 기준을 다르게 둬야 한다.

## 최종 원인 판단

이번 문제는 단순한 WebRTC fallback 문제가 아니라, 전체 ACTIVE camera가 한 번에 실행되면서 ffmpeg publisher, MediaMTX path, AI worker, WebRTC/HLS stream이 과다 생성되고 일부 path와 port가 충돌한 운영 구조 문제다. NVENC 실패를 피하기 위해 auto/copy 전환을 시도했지만 copy mode에서도 224/255 종료가 발생했으므로, 우선순위는 ffmpeg mode 변경이 아니라 camera allowlist와 process 중복 방지다.

## 운영 결정: camera 수 제한

camera 수 제한은 기능 축소가 아니라 실시간 안정성을 확보하기 위한 운영 제어다.

- 기능 검증 단계에서는 전체 ACTIVE camera를 모두 실행하지 않는다.
- smoke test 기본 대상은 `cam_01,cam_02,cam_03,cam_04`로 제한한다.
- 문제 재현 또는 빠른 검증은 단일 camera에서 시작한다.
- 확장은 `1 -> 2 -> 4` camera 순서로 진행한다.
- GPU가 이미 다른 작업으로 포화 상태이면 real inference test는 미룬다.
- WebRTC/HLS 영상 안정성 test와 AI bbox overlay test를 분리한다.

## 재현 및 진단 명령

process 전체 확인:

```bash
ps -eo pid,ppid,stat,cmd | grep -E "python|ffmpeg|start_simulated|run_registered|serve_ai|mediamtx|mosquitto|java|spring" | grep -v grep || true
```

개별 process 확인:

```bash
pgrep -af start_simulated_rtsp_from_folder.py || echo "없음"
pgrep -af run_registered_cameras.py || echo "없음"
pgrep -af serve_ai_overlay.py || echo "없음"
pgrep -af ffmpeg || echo "없음"
```

zombie 확인:

```bash
ps -eo pid,ppid,stat,cmd | awk '$3 ~ /Z/ {print}' || true
```

port 확인:

```bash
ss -tlnp | grep -E "8554|8888|8889|8189|1883|8080|18080" || true
```

HLS path 확인:

```bash
for cam in cam_01 cam_02 cam_03 cam_04 cam_05 cam_06 cam_07 cam_08 cam_10 cam_11 sge asd; do
  echo "===== $cam ====="
  curl -s -o /dev/null -w "HLS %{http_code}\n" "http://127.0.0.1:8888/${cam}/index.m3u8" || true
done
```

GPU 확인:

```bash
nvidia-smi
```

MediaMTX log:

```bash
docker logs --tail=200 mediamtx
```

publisher log:

```bash
tail -n 200 publisher.log
```

Git push 상태 확인:

```bash
git status
git log -5 --oneline
git branch --show-current
git remote -v
git status -sb
git log --oneline --decorate -5
```

## 성공 기준

정리 직후 성공 기준:

```text
start_simulated_rtsp_from_folder.py: 0개
run_registered_cameras.py: 0개
serve_ai_overlay.py: 0개
ffmpeg: 0개
defunct/zombie: 0개
MediaMTX/Mosquitto: 실행 중이어도 정상
```

smoke 실행 중 성공 기준:

```text
start_simulated_rtsp_from_folder.py: 정확히 1개
run_registered_cameras.py: 정확히 1개
serve_ai_overlay.py: allowlist camera 수만큼
ffmpeg: allowlist camera 수만큼
cam_01~cam_04만 실행
allowlist 밖 camera는 skipped
Force killing existing publisher 반복 없음
Scavenged duplicate 반복 없음
closing existing publisher 반복 없음
ffmpeg exit 224/255 반복 없음
WebRTC/HLS 5분 이상 유지
bbox overlay 5분 이상 갱신
```

## 다음 작업 TODO

- [ ] `start_simulated_rtsp_from_folder.py`에 camera allowlist를 적용한다.
- [ ] `run_registered_cameras.py`에 camera allowlist 또는 max cameras 옵션을 적용한다.
- [ ] `start_ai_stable.sh`의 smoke 기본값을 `cam_01~cam_04` 또는 단일 camera 모드로 제한한다.
- [ ] Windows `AI_실행_딸깍.bat`에서 원격 실행 시 allowlist 인자를 전달할 수 있게 한다.
- [ ] simulated publisher lock/PID file을 강화한다.
- [ ] 같은 RTSP path의 중복 publisher를 차단한다.
- [ ] 같은 cameraLoginId 또는 port의 중복 worker를 차단한다.
- [ ] ffmpeg 기본 정책은 `auto`로 두고 NVENC 실패 시 fallback, copy 실패 시 libx264 fallback을 명확히 한다.
- [ ] CPU/GPU 사용률 기반 camera 수 제한 정책을 검토한다.
- [ ] 프론트엔드에서 WebRTC 연결 상태, `framesDecoded` 증가 여부, HLS fallback 상태, AI overlay 상태를 분리해 표시한다.
- [ ] WebRTC/HLS 안정성 테스트와 bbox overlay 테스트를 분리한 smoke 절차를 문서에 연결한다.

---
#troubleshooting #webrtc #hls #mediamtx #ffmpeg #camera-limit #bbox #runtime-stability
