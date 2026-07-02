---
title: 2026-07-02 AI BBox54, Hard Negative, Overlay Tracking Debug Log
category: AI Pipeline
relatedDocs: [AI-Pipeline, Feature-Vector-51D-vs-54D, LSTM-Experiment-Results, MQTT-Event-Schema, Frame-Sync-Debug-Report]
relatedFiles: [strange_ai/docs/self_improving_error_mining_synthetic_data_plan.md, strange_ai/docs/hard_negative_retraining_comparison_guidebook.md, strange_ai/ai/publishers/mqtt_payloads.py, strange_ai/scripts/serve_ai_overlay.py, strange_ai/ai/postprocess/supervision_postprocessor.py, strange_front/src/features/dashboard/overlays/DetectionOverlayCanvas.tsx, strange_back/src/main/java/com/strange/safety/camera/overlay/OverlayEvent.java]
updatedAt: 2026-07-02
project: smart-safety-ai
type: evidence-log
portfolio_use: true
---

## Summary

2026-07-02 작업은 크게 세 축으로 진행되었다.

1. `keypoint_bbox54` 기반 Self-Improving AI 준비
2. hard negative 재학습 비교 파이프라인 검증
3. 실시간 overlay/MQTT/ByteTrack/display_id 문제 추적

핵심 결론은 다음과 같다.

- 54차원 bbox feature 모델은 51차원 zero padding 없이 별도 schema로 다루어야 한다.
- hard negative 추가 학습 비교는 같은 54차원 baseline 안에서만 비교해야 한다.
- 현재 확보된 hard negative 후보가 부족하거나 candidate type이 맞지 않으면 ratio 실험은 실질적 비교가 되지 않는다.
- overlay payload의 `trackingId`는 AI 내부 추적/DB/event correlation 기준이고, `displayId`/`displayLabel`은 화면 표시 전용이다.
- cam_05는 worker가 죽은 것이 아니라, bbox/keypoint 이후 track_id가 안정적으로 붙지 않아 sequence/LSTM/event 단계로 넘어가지 못하는 상태로 관측되었다.
- MQTT `frame_sync` 로그에서 `streamId=unknown`이 보이는 것은 frame_sync payload의 alias/logging 보완 포인트다.

## 1. BBox54 / Feature Schema

`keypoint_bbox54`는 17개 COCO keypoint의 `(x, y, confidence)` 51차원에 bbox 관련 3개 feature를 더한 54차원 schema다. 이번 작업에서 확인한 원칙은 다음과 같다.

- 51차원 feature 뒤에 `[0, 0, 0]`을 붙여 54차원처럼 쓰는 방식은 금지한다.
- `feature_schema=keypoint_bbox54`인 경우 실제 bbox 3개 feature가 계산되어야 한다.
- bbox feature가 없거나 54차원이 아니면 train 후보에 넣지 않고 제외 또는 quarantine 처리한다.
- 기존 production 기본 모델과 threshold는 변경하지 않는다.

관련 검증/도구:

- `inspect_lstm_feature_shape.py`
- `build_training_manifest_v2.py`
- `inspect_candidate_manifest.py`
- `export_hard_negative_ratios.py`
- `evaluate_retraining_manifest_v2.py`

## 2. Self-Improving AI 준비 상태

Self-Improving AI 파이프라인의 목적은 production 모델을 바로 교체하는 것이 아니라, 실제 운영/평가 중 발생한 오류를 안전하게 모아 재학습 후보로 관리하는 것이다.

구현/정리된 흐름:

```text
prediction/evaluation output
-> FP/FN 판정
-> FP: hard negative candidate
-> FN: faint/fall reinforcement candidate
-> 검증 불가 row: quarantine
-> approved 후보만 후속 export 가능
-> synthetic data는 feature-level dry-run/preview까지만 허용
```

manifest 필수 메타데이터:

- `source_video`
- `clip_id`
- `start_frame`, `end_frame`, `frameId`
- `prediction_label`, `prediction_score`
- `ground_truth_label`
- `threshold`
- `model_name`, `checkpoint_path`
- `sequence_length`, `sequence_stride`
- `feature_schema`, `feature_dim`
- `bbox_features`
- `keypoint_confidence_summary`
- `review_status`

## 3. Hard Negative 재학습 비교 상태

hard negative 비교 목표는 51차원 모델과 54차원 모델을 섞어 비교하는 것이 아니라, 같은 `keypoint_bbox54` 구조에서 baseline과 HN 추가 모델을 비교하는 것이다.

비교 기준:

- 동일 evaluation split 사용
- 동일 input size 54
- 동일 feature schema `keypoint_bbox54`
- threshold sweep `0.3, 0.4, 0.5, 0.6, 0.7`
- Accuracy, Precision, Recall, F1, FP, FN, TP, TN 저장
- baseline 대비 FP 감소량과 FN 증가량 분리 계산
- Recall 손실 여부 명시

중요 관측:

- `training_manifest_v2.csv`는 생성되었지만 초기에 실제 HN 후보 CSV가 없었다.
- `hard_negative_candidates.jsonl`에는 sample 후보 2개만 있었고, 실험용으로는 부족했다.
- 이후 real error 기반 export에서 `approved_hard_negative_available=0`으로 관측된 적이 있다.
- candidate가 `candidate_type` 조건을 만족하지 않으면 ratio별 export 결과가 baseline과 동일해져 성능 비교 의미가 없다.
- 어떤 평가에서는 baseline과 retrained 모두 1.0 score가 나와 HN 효과를 판단할 수 없었다. 이 경우 split이 너무 쉽거나 같은 분포/중복 가능성을 점검해야 한다.

따라서 다음 단계는 실제 FP/FN 후보를 충분히 확보하고, `review_status=approved`, `candidate_type=hard_negative`, `feature_schema=keypoint_bbox54`, `feature_dim=54` 조건을 통과시키는 것이다.

## 4. MQTT / Overlay Payload 정리

AI overlay/event payload에서 ID 역할을 분리했다.

| Field | 용도 |
| --- | --- |
| `trackingId` | AI 내부 추적 ID, LSTM sequence, MQTT event, DB correlation 기준 |
| `trackId`, `track_id` | `trackingId` 호환 alias |
| `displayId`, `display_id` | 관제 화면 표시용 ID |
| `displayLabel` | 화면 표시용 label |

중요 원칙:

- raw ByteTrack ID를 `displayId`로 덮어쓰지 않는다.
- `displayId` 재사용은 화면 표시에서만 허용한다.
- DB/event correlation에는 `trackingId`를 유지한다.
- frontend는 `displayLabel` 또는 `displayId`를 우선 표시하고, debug 모드에서 raw `trackingId`를 볼 수 있게 한다.

Backend DTO는 `trackingId`, `trackId`, `track_id`, `displayId`, `display_id`, `displayLabel`을 하위 호환성 있게 받아야 한다.

Frontend overlay label 문제:

- 이전에는 track id가 없을 때 `ID ? ID_1`처럼 중복 라벨이 표시될 수 있었다.
- 표시 label 조합을 수정해 missing raw id인 경우 fallback display label만 보여주도록 했다.

## 5. cam_05 Tracking Debug 결론

사용자가 GPU PC에서 제공한 로그 기준:

```text
cam_05: bbox=2 keypoints=2 active_tracks=0 seq=0 pred=0 latest_faint_prob=None
cam_05: bbox=1 keypoints=1 active_tracks=0 seq=0 pred=0 latest_faint_prob=None
cam_04: bbox=5 keypoints=5 active_tracks=1 seq=0 pred=0 latest_faint_prob=None
```

해석:

- cam_05 worker는 실행 중이다.
- cam_05에서 사람 bbox/keypoints는 잡힌다.
- 그러나 tracker가 안정적인 `track_id`를 붙이지 못하거나 sequence buffer가 사용할 track을 만들지 못한다.
- 그 결과 `seq=0`, `pred=0`이고 LSTM까지 입력이 가지 않는다.
- 따라서 cam_05가 fainting으로 바뀌지 않는 것은 현재 모델 threshold 이전 단계의 문제다.

실시간 이벤트 흐름은 다음 순서를 통과해야 한다.

```text
YOLO bbox/keypoints
-> ByteTrack/SimpleTracker track_id
-> per-track sequence buffer
-> LSTM prediction
-> faint_probability attached to bbox
-> overlay type=faint
-> consecutive/cooldown policy
-> MQTT event
```

cam_05는 현재 `track_id -> sequence` 구간에서 막히는 것으로 판단한다.

## 6. MQTT 관측 이슈

로그에서 다음 형태가 함께 관측되었다.

```text
[mqtt] publish failed: topic=camera, messageType=overlay, streamId=cam_05, rc=4
[mqtt] published: topic=camera, messageType=overlay, streamId=cam_05
[mqtt] published: topic=camera, messageType=frame_sync, streamId=unknown
```

해석:

- `rc=4`는 MQTT client가 publish 시점에 연결되어 있지 않거나 연결 상태가 흔들릴 때 발생할 수 있다.
- 이후 `published`도 나오므로 영구 장애라기보다는 재연결/타이밍 문제가 섞여 있다.
- `frame_sync streamId=unknown`은 frame_sync payload에 `cameraLoginId`는 있지만 `_payload_context()`가 보는 `streamId` alias가 없어 로그가 unknown으로 찍히는 별도 개선 포인트다.

개선 후보:

- `build_frame_sync_payload()`에도 `streamId=camera_login_id` 추가
- MQTT reconnect 상태 로그 강화
- publish 실패 시 cameraLoginId/topic/messageType/frameId를 더 명확히 남김

## 7. 운영 판단 기준

이날 결론상 바로 해야 할 일은 threshold 조정이나 production 모델 교체가 아니다.

우선순위:

1. cam_05에서 `detections > 0`이지만 `tracked = 0`인지 `TRACKING_DEBUG=true`로 확인
2. tracker 설정 비교: `track_thresh`, `match_thresh`, `track_buffer`, `tracking_mode`
3. cam_04/cam_05 worker 실행 인자와 env가 동일한지 확인
4. frame_sync payload에 `streamId` alias 추가
5. track_id가 붙은 뒤에도 `seq=0`이면 sequence_length/stride/keypoint buffer를 확인
6. `pred > 0`인데 overlay가 tracking이면 `annotate_boxes_with_track_actions()`와 payload mapping 확인

## 8. 재현/점검 명령

GPU PC에서 tracking debug를 켜고 worker를 재시작한다.

```bash
cd ~/yolo_training/strange_ai_lstm
source .venv/bin/activate
export TRACKING_DEBUG=true
python scripts/run_registered_cameras.py
```

실행 중인 worker 확인:

```bash
ps aux | grep serve_ai_overlay.py | grep -v grep
```

cam_05/cam_04 tracking 비교:

```bash
grep -nE "Tracking Debug|camera: cam_05|detections:|tracked:|active_ids|mapping" \
  runs/registered_cameras/cam_05-overlay.log | tail -n 80

grep -nE "Tracking Debug|camera: cam_04|detections:|tracked:|active_ids|mapping" \
  runs/registered_cameras/cam_04-overlay.log | tail -n 80
```

일반 overlay debug 비교:

```bash
grep -n "ai-overlay-debug" runs/registered_cameras/cam_05-overlay.log | tail -n 40
grep -n "ai-overlay-debug" runs/registered_cameras/cam_04-overlay.log | tail -n 40
```

MQTT raw 확인 시 `-C 20`은 메시지 수를 채울 때까지 기다리므로 멈춘 것처럼 보일 수 있다. 대신 timeout을 사용한다.

```bash
timeout 10s mosquitto_sub -h localhost -p 1883 -t camera -v
timeout 10s mosquitto_sub -h localhost -p 1883 -t camera -v | grep -E "cam_04|cam_05"
```

## 9. 남은 위험

- cam_05와 cam_04가 같은 또는 비슷한 영상이라도 worker 실행 인자, tracker state, confidence, frame drop, assigned source, RTSP timing 차이로 tracking 결과가 갈릴 수 있다.
- `active_tracks=0`은 단순히 worker가 죽었다는 뜻이 아니라 LSTM sequence buffer로 넘어갈 track id가 없다는 신호로 봐야 한다.
- HN 재학습 효과는 실제 approved real error 후보가 충분히 확보되기 전에는 판단할 수 없다.
- baseline/retrained가 모두 1.0인 평가는 lab split이 너무 쉬운지, 중복/누수/동일 분포인지 별도 점검해야 한다.

## 10. 다음 작업

1. `TRACKING_DEBUG=true` 상태로 cam_04/cam_05 tracker 상세 로그 확보
2. `build_frame_sync_payload()`에 `streamId` 추가
3. cam_05 tracker threshold 실험을 production 기본값 변경 없이 별도 실험으로 수행
4. HN candidate export에서 `candidate_type=hard_negative`가 올바르게 들어가는지 검증
5. 충분한 approved HN 후보 확보 후 `hn_0.05`, `hn_0.10`, `hn_0.20` 비교 재실행

---

#ai #bbox54 #hard-negative #bytetrack #mqtt #overlay #cam05 #tracking-debug
