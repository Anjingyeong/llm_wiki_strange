---
title: LSTM Experiment Results
category: AI Pipeline
tags: [lstm, experiment-results, threshold, model-comparison, yolo26n]
relatedDocs: [LSTM, Model-Comparison, Benchmark-History]
relatedFiles: [.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv, docs/wiki/data/modelMetrics.json]
updatedAt: 2026-06-26
---

# LSTM Experiment Results

## 목적

Pose extractor(YOLO 코드 계열)에 따른 keypoint sequence 질이 LSTM의 Normal/Faint 판단에 어떻게 영향을 주는지, GPU PC에서 실행한 downstream LSTM 평가 결과를 기준으로 정리한다.

## 배경

이전 로컬에서 확인한 `benchmark/results/lstm_sequence_length_8_16_30/summary.csv`는 `missing_metadata` 상태라 성능 판단에 쓸 수 없었다. 이후 GPU PC에서 실행된 `lstm_extractor_comparison_fast` 결과를 로컬로 받아 확정 지표로 반영했다.

이 문서는 해당 결과가 어떤 코드 경로에서 생성됐는지, 신뢰할 수 없는 이전 결과와 어떻게 구분되는지, threshold별 운영 성격이 어떻게 달라지는지를 정리한다.


## 핵심 내용

기본 threshold 기준 `yolo26n-pose`가 Faint Recall 0.750877로 가장 높다. FN은 142개로 후보군 중 가장 적다. 이 결과는 pose extractor별 downstream LSTM 비교이며, 현재 코드 기준 keypoint feature는 51D에 motion feature 3개를 붙인 54D 구조다.

| Model | Eval Normal | Eval Faint | Pred Normal | Pred Faint | FP | FN | Recall | Precision | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| yolo26n-pose | 785 | 570 | 527 | 828 | 400 | 142 | 0.750877 | 0.516908 | 0.612303 |
| yolo26s-pose | 846 | 745 | 707 | 884 | 390 | 251 | 0.663087 | 0.558824 | 0.606507 |
| yolo11n-pose | 748 | 569 | 707 | 610 | 236 | 195 | 0.657293 | 0.613115 | 0.634436 |
| yolo11s-pose | 736 | 547 | 736 | 547 | 228 | 228 | 0.583181 | 0.583181 | 0.583181 |
| yolov8n-pose | 773 | 605 | 879 | 499 | 181 | 287 | 0.525620 | 0.637275 | 0.576087 |
| yolov8s-pose | 828 | 707 | 1255 | 280 | 82 | 509 | 0.280057 | 0.707143 | 0.401216 |

### YOLO26n Threshold Audit

`yolo26n-pose`는 threshold에 따라 운영 성격이 크게 달라진다.

| Threshold | Recall | Precision | F1 | Predicted Faint | 해석 |
| ---: | ---: | ---: | ---: | ---: | --- |
| 0.3 | 0.917544 | 0.439127 | 0.593981 | 1191 | 미탐 최소화, 오탐 증가 |
| 0.4 | 0.870175 | 0.494024 | 0.630241 | 1004 | recall 중시 운영 후보 |
| 0.5 | 0.750877 | 0.516908 | 0.612303 | 828 | 현재 기본 비교값 |
| 0.6 | 0.722807 | 0.608567 | 0.660786 | 677 | F1 균형 최상 후보 |
| 0.7 | 0.494737 | 0.638009 | 0.557312 | 442 | 미탐 증가로 위험 |

## 입력

- Pose model: `yolo26n-pose.pt`, `yolo26s-pose.pt`, `yolo11n-pose.pt`, `yolo11s-pose.pt`, `yolov8n-pose.pt`, `yolov8s-pose.pt`
- LSTM 입력: keypoint sequence
- 클래스: `Normal`, `Faint`
- 평가 결과: `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`

## 출력

- 모델별 Recall, Precision, F1, Accuracy
- FP/FN confusion matrix 해석
- `yolo26n-pose` threshold 후보

## 동작 흐름

```text
video clip
-> pose extractor
-> keypoint sequence
-> LSTM
-> Normal/Faint probability
-> threshold
-> event decision
```

## 관련 파일

- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/yolo26n-pose/summary.json`
- `docs/wiki/data/modelMetrics.json`
- `strange_ai/ai/action/motion_features.py`
- `benchmark/results/lstm_sequence_length_8_16_30/summary.csv`

## 관련 문서

- [LSTM](LSTM.md)
- [Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md)
- [LSTM-Sequence-Length-Comparison](LSTM-Sequence-Length-Comparison.md)
- [Model-Comparison](Model-Comparison.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)

## 주의사항

threshold 0.3이나 0.4는 recall을 크게 올리지만 predicted faint 수가 늘어난다. 알림 scope 버그가 남아 있으면 이 오탐이 사용자에게 더 크게 보일 수 있다.

## 후속 작업

- 운영 후보 threshold를 0.5와 0.6으로 나눠 RTSP/WebRTC smoke test를 실행한다.
- 알림 정책에서는 Faint Recall뿐 아니라 FP 전파 경로와 사용자 소유 카메라 scope를 함께 검증한다.
