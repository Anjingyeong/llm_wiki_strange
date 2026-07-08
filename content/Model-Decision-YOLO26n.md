---
title: Model Decision YOLO26n
navTitle: YOLO26n 결정
shortTitle: YOLO26n 결정
category: Experiments
relatedDocs: [AI-Pipeline, LSTM, Model-Comparison, Benchmark-History]
relatedFiles: [docs/MODEL_BENCHMARK_REPORT.md, docs/AI_TRAINING_DIRECTION.md, docs/wiki/data/modelMetrics.json]
updatedAt: 2026-06-26
project: smart-safety-ai
type: model-decision
portfolio_use: true
---

## 목적

YOLOv8n, YOLOv11n, YOLO26n, YOLOv8s 계열 pose 모델 비교 결과와 `YOLO26n-pose` 선택 이유를 기록한다.

## 배경

관제 시스템에서 pose extractor는 단독 모델이 아니라 LSTM 이벤트 판단 앞단이다. 좋은 extractor는 단순히 빠른 모델이 아니라, 실신 클래스에 유효한 keypoint sequence를 안정적으로 만들어야 한다.

## 핵심 내용

2026-06-26에 로컬로 받은 GPU benchmark 결과 기준으로 `yolo26n-pose`를 유지한다. 판단 기준은 Faint Recall 우선이다.

| Model | Faint Recall | F1 | Precision | Accuracy | 판단 |
| --- | ---: | ---: | ---: | ---: | --- |
| yolo26n-pose | 0.750877 | 0.612303 | 0.516908 | 0.600000 | 선택. 실신 누락 최소화 기준 1위 |
| yolo26s-pose | 0.663087 | 0.606507 | 0.558824 | 0.597109 | recall 2위지만 runtime이 더 길고 yolo26n 대비 이점 제한적 |
| yolo11n-pose | 0.657293 | 0.634436 | 0.613115 | 0.672741 | F1/accuracy 최상. false alarm 비용이 커지면 재검토 후보 |
| yolo11s-pose | 0.583181 | 0.583181 | 0.583181 | 0.644583 | recall이 낮아 우선순위 하락 |
| yolov8n-pose | 0.525620 | 0.576087 | 0.637275 | 0.660377 | 속도는 좋지만 실신 recall 부족 |
| yolov8s-pose | 0.280057 | 0.401216 | 0.707143 | 0.614984 | precision은 높지만 FN이 많아 제외 |

`yolo11n-pose`는 기본 threshold 기준 F1과 Accuracy가 가장 좋다. 그럼에도 현재 프로젝트의 우선순위가 "실신 미탐 방지"이므로 `yolo26n-pose`를 선택한다.

## 입력

- 동일 데이터 split에서 생성된 pose keypoint sequence
- LSTM Normal/Faint 평가 결과
- threshold sweep 결과
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`

## 출력

- 운영 기본 후보: `YOLO26n-pose`
- 비교 후보: `YOLO11n-pose`
- 조정 포인트: threshold 0.5와 0.6 비교

## 동작 흐름

```text
pose model candidates
-> keypoint sequence extraction
-> LSTM Normal/Faint evaluation
-> Faint Recall first ranking
-> threshold audit
-> operational false-alarm review
-> model decision
```

## 관련 파일

- `docs/wiki/data/modelMetrics.json`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/yolo26n-pose/summary.json`

## 관련 문서

- [AI-Pipeline](AI-Pipeline.md)
- [LSTM](LSTM.md)
- [Model-Comparison](Model-Comparison.md)
- [Benchmark-History](Benchmark-History.md)

## 주의사항

이 결정은 AI 단독 지표만으로 완결되지 않는다. `yolo26n-pose`는 Faint Recall이 높지만 FP도 400개로 많다. 운영 알림 정책, 카메라 소유 범위, cooldown, confidence threshold를 함께 검증해야 한다.

## 후속 작업

- `yolo26n-pose` threshold 0.6에서 F1 0.660786, Recall 0.722807로 균형이 개선되는지 운영 영상에서 확인한다.
- `yolo11n-pose`를 fallback 후보로 남기고, false alarm 비용이 더 커지는 환경에서 재평가한다.

---
#model-decision #yolo #benchmark #faint-recall #evidence
