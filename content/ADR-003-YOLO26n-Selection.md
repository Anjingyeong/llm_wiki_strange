---
title: ADR-003 YOLO26n Selection
category: ADR
tags: [adr, yolo26n, model-selection, benchmark, faint-recall]
relatedDocs: [Model-Comparison, Model-Decision-YOLO26n, LSTM-Experiment-Results]
relatedFiles: [docs/wiki/data/modelMetrics.json, .tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv]
updatedAt: 2026-06-26
---

# ADR-003 YOLO26n Selection

## 목적

Pose extractor 기본 후보를 `yolo26n-pose`로 유지하는 결정을 기록한다.

## 배경

실신 감지는 precision만 높은 모델보다 Faint Recall이 높은 모델이 운영상 유리하다. 놓친 실신은 관제 공백으로 이어지지만, 오탐은 cooldown, scope, 후처리 정책으로 일부 완화할 수 있다.

## 핵심 내용

Decision:

- 기본 pose extractor는 `yolo26n-pose.pt`로 둔다.
- ranking 기준은 `Faint Recall` 1순위, `F1-Score` 2순위다.
- `yolo11n-pose`는 F1/accuracy가 더 높으므로 false alarm 비용이 큰 환경의 비교 후보로 남긴다.

확인된 기준 파일:

```text
.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv
.tmp/gpu_benchmark/lstm_extractor_comparison_fast/yolo26n-pose/summary.json
```

핵심 수치:

| Model | Recall | Precision | F1 | FP | FN | Threshold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| yolo26n-pose | 0.750877 | 0.516908 | 0.612303 | 400 | 142 | 0.5 |
| yolo11n-pose | 0.657293 | 0.613115 | 0.634436 | 236 | 195 | 0.5 |

## 입력

- GPU benchmark summary
- per-model summary JSON
- LSTM Normal/Faint validation split

## 출력

- 선택 모델: `yolo26n-pose`
- 비교 후보: `yolo11n-pose`
- threshold 검토 후보: `0.5`, `0.6`

## 동작 흐름

```text
six pose models
-> keypoint sequence extraction
-> LSTM evaluation
-> recall-first ranking
-> threshold audit
-> operating model decision
```

## 관련 파일

- `docs/wiki/data/modelMetrics.json`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/yolo26n-pose/summary.json`

## 관련 문서

- [Model-Comparison](Model-Comparison.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)
- [LSTM-Experiment-Results](LSTM-Experiment-Results.md)

## 주의사항

`yolo26n-pose`는 FP가 많다. 선택 이유는 "가장 완벽해서"가 아니라 "미탐을 줄이는 현재 운영 우선순위에 가장 맞아서"다.

## 후속 작업

운영 영상에서 threshold 0.6의 F1 개선이 알림 품질을 실제로 높이는지 확인한다.
