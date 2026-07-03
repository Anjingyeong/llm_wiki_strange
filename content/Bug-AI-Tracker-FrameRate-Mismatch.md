---
title: Bug - AI Tracker Frame Rate Mismatch and Notification Failure
category: Troubleshooting
relatedDocs: [AI-Pipeline, WebRTC-vs-HLS, 2026-07-03-AI-Worker-Flow-Improvements-Log]
relatedFiles: [strange_ai/ai/postprocess/supervision_postprocessor.py, scripts/serve_ai_overlay.py, strange_ai/ai/registered_cameras.py]
updatedAt: 2026-07-03
project: smart-safety-ai
type: bug-report
portfolio_use: true
---

## 1. 현상 (Symptom)
* **이상 징후**: 시스템 전반(ROI 설정 여부 불관)에서 AI 이상행동 감지 알림이 전혀 수신되지 않는 현상 발생.
* **진단 확인**: YOLO pose 단계에서는 검출 신뢰도 0.6~0.9 수준으로 객체 탐지 및 17개 키포인트 추출이 정상 작동 중이나, `safety/events` MQTT 토픽으로 어떠한 이벤트도 발행되지 않고 있었음.

---

## 2. 원인 분석 (Root Cause)

### 2.1 트래커 불안정 및 트랙 ID 소실
* `TRACKING_DEBUG=true`를 통한 프레임별 진단 결과, 트래커가 탐지된 객체에 대해 연속적인 트랙 ID(Track ID)를 부여하지 못하고 매 1~2프레임마다 트랙 ID가 초기화되거나 소실(null)되는 현상 관측. (예: `trackId=1` -> `null` -> `trackId=2` 형태로 매칭 실패 반복)
* 원인은 `ai/postprocess/supervision_postprocessor.py` 내부에서 ByteTrack 인스턴스 초기화 시 프레임레이트(`frame_rate`) 설정이 `30`으로 고정(Hard-coded)되어 있었기 때문임.

### 2.2 칼만 필터의 시간차(dt) 예측 오류
* 실제 시스템 환경의 GPU 연산 속도 및 AI inference 주기(Heartbeat 기준)는 **약 15fps** 내외로 작동하고 있었음.
* ByteTrack 내부의 칼만 필터(Kalman Filter)는 이전 프레임의 속도 정보를 바탕으로 다음 프레임에서의 위치를 예측함.
* 프레임레이트 변수가 30fps로 하행 고정되어 있으면, 실제 시간 간격($dt \approx 0.067s$)보다 2배 짧은 시간 간격($dt \approx 0.033s$)으로 프레임이 인입된다고 알고리즘이 오인함.
* 이로 인해 실제 프레임별 이동 속도가 예측 속도보다 2배 과도하게 산출되어, 칼만 필터의 차기 위치 예측 바운딩 박스가 실제 탐지 위치와 매칭(IoU)에 크게 빗나가며 트랙 연결이 즉각 실패함.

```text
[실제 프레임 간격 (dt = 0.067s, 15fps)]  ==========> 실제 이동 거리 d
[트래커가 착각한 간격 (dt = 0.033s, 30fps)] ===> 칼만 필터의 예측 위치가 절반 수준에 그쳐 매칭 실패
```

### 2.3 LSTM 분류기 임계 조건 미달
* 트랙 ID가 계속 소실됨에 따라, LSTM 분류기의 활성화 및 이벤트 추론 최소 요건인 **'동일 트랙 ID로 연속 30프레임 이상 버퍼링(`--sequence-length 30`)'** 조건을 단 한 번도 도달하지 못함.
* 진단 로그에 `sequencesGenerated: 0`이 유지되며, 분류 모델 추론 단계로 진입하지 못해 이벤트가 발행되지 않음.

---

## 3. 대응 및 해결 방안 (Resolution)

### 3.1 CLI 옵션 파이프라인 추가
* **배포 브랜치**: `codex/ai-worker-flow-improvements`
* **설정 옵션 도입**: `scripts/serve_ai_overlay.py` 파일의 인수 파서(Argparser)에 `--frame-rate` CLI 옵션을 추가함.
* **런타임 전파**: `ai/registered_cameras.py` 내 `RunnerConfig` 및 `build_overlay_command` 로직을 수정하여, 시스템 기동 시 할당된 카메라 워커 구동 명령어에 동적으로 해당 `--frame-rate` 값을 바인딩하여 실행하도록 변경함.

### 3.2 1차 보정값 반영
* 현행 GPU 및 연산 서버의 인프라 실측치를 반영해 기본 `--frame-rate` 설정을 `15`로 낮추어 매칭 안정성을 확보함. 수정 이후 동일 트랙에 대한 트랙 유실 현상이 해결되고 LSTM 시퀀스 버퍼가 지속적으로 갱신되어 정상 알림이 재개됨.

---

## 4. 향후 과제 (Future Action)
* 현재 15fps 지정은 고정값 대입 방식으로, GPU 사용률이나 다중 채널 로드율 변동에 따라 실시간 FPS가 하락할 경우 트래킹이 다시 저하될 여지가 있음.
* **근본적 개선안**: 매 프레임의 인입 간격을 실시간 타임스탬프 기준(Dynamic Timestep $dt$)으로 실측하여 ByteTrack 업데이트 주기에 직접 동적 전달하는 구조 개편안에 대한 기술 검토가 필요함.
