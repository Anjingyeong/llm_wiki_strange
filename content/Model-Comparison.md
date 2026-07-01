---
title: Model Comparison
category: Experiments
relatedDocs: [Model-Decision-YOLO26n, Benchmark-History, LSTM-Experiment-Results]
relatedFiles: [docs/wiki/data/modelMetrics.json, .tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv]
updatedAt: 2026-06-26
---

## 목적

YOLO 계열 pose extractor 후보를 downstream LSTM 평가 기준으로 비교하고, 관제 서비스에서 우선해야 할 모델 선택 근거를 남긴다.

실신 감지는 놓친 이벤트(미탐)의 비용이 오탐보다 훨씬 크다고 보기 때문에, 정렬 기준은 Faint Recall 1순위, F1-Score 2순위로 둔다.

## 배경

이 서비스의 실패 비용은 실신 이벤트를 놓치는 쪽이 더 크다. 오탐은 cooldown, scope, 후처리 정책으로 일부 완화할 수 있지만, 미탐은 관제 공백으로 직결된다. FPS와 pose-only latency는 운영 가능성 판단에는 쓰지만, 최종 순위의 1차 기준으로 쓰지 않는다.

## 핵심 내용

로컬로 받은 GPU 결과 `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`를 기준으로 여섯 개 모델을 다시 정리했다. 모든 row의 `metrics_status`는 `OK`, `torch_device`는 `cuda:0`이다.

| Rank | Model | Faint Recall | F1-Score | Precision | Accuracy | FP | FN | Missing Rate | Eval Sequences | Runtime(s) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | yolo26n-pose | 0.750877 | 0.612303 | 0.516908 | 0.600000 | 400 | 142 | 0.128261 | 1355 | 361.6531 |
| 2 | yolo26s-pose | 0.663087 | 0.606507 | 0.558824 | 0.597109 | 390 | 251 | 0.126229 | 1591 | 369.6238 |
| 3 | yolo11n-pose | 0.657293 | 0.634436 | 0.613115 | 0.672741 | 236 | 195 | 0.090368 | 1317 | 345.3193 |
| 4 | yolo11s-pose | 0.583181 | 0.583181 | 0.583181 | 0.644583 | 228 | 228 | 0.116475 | 1283 | 379.9346 |
| 5 | yolov8n-pose | 0.525620 | 0.576087 | 0.637275 | 0.660377 | 181 | 287 | 0.092656 | 1378 | 329.1220 |
| 6 | yolov8s-pose | 0.280057 | 0.401216 | 0.707143 | 0.614984 | 82 | 509 | 0.119393 | 1535 | 336.5217 |

결론은 `yolo26n-pose` 유지다. 기본 threshold에서 Faint Recall이 가장 높고 FN이 가장 낮다. 다만 `yolo11n-pose`는 F1, Precision, Accuracy가 더 높으므로, 오탐 비용이 더 큰 운영 정책에서는 비교 후보로 남긴다.

## 입력

- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/<model>/summary.json`
- 원격 원본 경로: `/home/welabs/yolo_training/strange_ai_lstm/benchmark/results/lstm_extractor_comparison_fast`

## 출력

- 정렬 기준: Faint Recall desc, F1-Score desc
- 선택 모델: `yolo26n-pose`
- 검색/문서용 구조화 데이터: `docs/wiki/data/modelMetrics.json`

## 동작 흐름

```text
load summary.csv
-> filter metrics_status=OK
-> sort by Faint Recall desc, F1-Score desc
-> read per-model summary.json for confusion matrix FP/FN
-> record ranking in Wiki docs and modelMetrics.json
```

## 관련 파일

- `docs/wiki/data/modelMetrics.json`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/<model>/summary.json`

## 관련 문서

- [Benchmark-History](Benchmark-History.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)
- [LSTM-Experiment-Results](LSTM-Experiment-Results.md)

## 주의사항

`yolo26n-pose`는 recall-first 정책의 선택이다. FP 400개가 함께 증가하므로 운영 threshold, notification scope, cooldown 정책과 같이 봐야 한다.

## 후속 작업

- 운영 영상 smoke test에서 `yolo26n-pose` threshold 0.5와 0.6을 비교한다.
- 기업/개인 카메라 알림 scope 버그 재현 케이스와 연결해 false alarm이 알림으로 전파되는 경로를 점검한다.

---
#model-comparison #benchmark #yolo #faint-recall #evidence
