---
title: LSTM
category: AI Pipeline
tags: [lstm, sequence, threshold, normal, faint]
relatedDocs: [AI-Pipeline, Model-Decision-YOLO26n]
relatedFiles: [docs/AI_GUIDE.md, docs/ai_training_preprocessing_summary.md, strange_ai/ai/action/classifier.py]
updatedAt: 2026-06-26
---

# LSTM

## 목적

LSTM 입력 shape, sequence length, stride, class, threshold 개념을 한 곳에 정리한다.

## 배경

AI worker는 frame 단위 YOLO 결과를 곧바로 이벤트로 만들지 않고, track별 시간 흐름을 sequence로 묶어 행동 분류 모델에 전달한다.

## 핵심 내용

- 입력 shape: `(Batch, sequence_length, 51)`
- 51차원: 17개 keypoint의 `(x, y, confidence)`
- 기본 운영 후보: `sequence_length=8`, `stride=4`
- 비교 후보: `16/8`, `30/15`
- class: `Normal`, `Faint`
- threshold: `Faint` 확률이 기준값 이상이면 Faint 후보로 본다.

## 입력

track별 keypoint sequence와 LSTM checkpoint metadata가 입력이다. checkpoint에는 class mapping, input size, sequence 설정이 포함되어야 한다.

## 출력

```json
{
  "label": "Faint",
  "probabilities": {
    "Normal": 0.18,
    "Faint": 0.82
  }
}
```

## 동작 흐름

1. track별 keypoint를 buffer에 적재한다.
2. buffer가 `sequence_length`를 채우면 sequence를 생성한다.
3. LSTM logits와 softmax probability를 계산한다.
4. `Faint` 확률이 threshold 이상인지 확인한다.
5. 연속 감지와 cooldown을 통과하면 이벤트를 확정한다.

## 관련 파일

- `strange_ai/ai/action/classifier.py`
- `strange_ai/ai/action/keypoint_sequence_buffer.py`
- `strange_ai/ai/action/faint_post_processing.py`

## 관련 문서

- [AI-Pipeline](AI-Pipeline.md)

## 주의사항

threshold를 낮추면 Faint recall은 올라갈 수 있지만 false alarm도 증가할 수 있다. 운영 후보는 모델 audit와 RTSP smoke test를 함께 보고 정한다.

## 후속 작업

sequence `8/4`, `16/8`, `30/15`를 같은 split에서 비교하고 latency와 recall 균형을 기록한다.
