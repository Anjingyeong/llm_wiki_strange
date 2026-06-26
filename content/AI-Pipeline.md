---
title: AI Pipeline
category: AI Pipeline
tags: [ai, yolo26n, bytetrack, keypoint, lstm]
relatedDocs: [LSTM, Model-Decision-YOLO26n, MQTT-Event-Schema]
relatedFiles: [docs/AI_GUIDE.md, strange_ai/ai/action, strange_ai/ai/inference]
updatedAt: 2026-06-26
---

# AI Pipeline

## 목적

RTSP 입력에서 MQTT 이벤트까지 이어지는 AI worker의 판단 흐름을 LLM이 빠르게 복원할 수 있게 정리한다.

## 배경

현재 방향은 YOLO를 재학습하는 것이 아니라 `YOLO26n-pose`를 고정한 뒤 keypoint sequence 기반 LSTM으로 `Normal/Faint`를 분류하는 것이다.

## 핵심 내용

AI 파이프라인은 다음 요소로 구성된다.

- `YOLO26n-pose`: 사람 bbox와 17개 COCO keypoint 추출
- ByteTrack 또는 fallback tracker: 동일 인물의 `track_id` 연속성 유지
- Keypoint sequence: track별 `(x, y, confidence)`를 시간 순서로 적재
- LSTM: sequence를 받아 `Normal/Faint` 확률 산출
- 이벤트 판단: threshold, 연속 감지, cooldown을 통과하면 MQTT publish

## 입력

- `rtsp://<host>:8554/{cameraLoginId}`
- YOLO pose checkpoint
- LSTM checkpoint
- `sequence_length`, `sequence_stride`, threshold 설정

## 출력

- `Faint` 후보 또는 확정 이벤트
- bbox, confidence, track_id, timestamp metadata
- MQTT `safety/events` payload

## 동작 흐름

```text
RTSP frame
-> YOLO26n-pose bbox/keypoints
-> tracker assigns track_id
-> PerTrackKeypointSequenceBuffers
-> LSTM Normal/Faint probabilities
-> threshold and debounce
-> MQTT event
```

## 관련 파일

- `docs/AI_GUIDE.md`
- `strange_ai/ai/action/keypoint_sequence_buffer.py`
- `strange_ai/ai/action/per_track_sequence_buffer.py`
- `strange_ai/ai/action/faint_post_processing.py`

## 관련 문서

- [LSTM](LSTM.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)

## 주의사항

`sequence_stride`는 FPS sampling 값이 아니라 다음 sequence 시작 간격이다. 예를 들어 `8/4`는 8프레임 sequence를 만들고 4프레임 뒤 다음 sequence 생성을 허용한다.

## 후속 작업

FP/FN clip을 error type별로 축적해 hard negative와 missed Faint 보강 데이터로 연결한다.
