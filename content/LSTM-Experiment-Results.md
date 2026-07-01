---
title: LSTM Experiment Results
category: AI Pipeline
relatedDocs: [LSTM, Model-Comparison, Benchmark-History]
relatedFiles: [.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv, docs/wiki/data/modelMetrics.json, gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json]
updatedAt: 2026-06-26
---

## 목적

Pose extractor(YOLO 코드 계열)에 따른 keypoint sequence 질이 LSTM의 Normal/Faint 판단에 어떻게 영향을 주는지, GPU PC에서 실행한 downstream LSTM 평가 결과를 기준으로 정리한다.

## 배경

이전 로컬에서 확인한 `benchmark/results/lstm_sequence_length_8_16_30/summary.csv`는 `missing_metadata` 상태라 성능 판단에 쓸 수 없었다. 이후 GPU PC에서 실행된 `lstm_extractor_comparison_fast` 결과를 로컬로 받아 확정 지표로 반영하고, 대규모 최종 분할 데이터셋을 사용한 `lstm_yolo26n_final_split_test_audit` 실험 결과를 수행하여 지표를 확보했다.

---

## 핵심 내용

### 1. Final YOLO26n-pose Split Test Audit (최종 대규모 데이터셋)
전체 데이터셋(Stratified Source Video Split 기준: train 14,068 / val 3,042 / test 2,784)에 대하여 `Oversample` 처리를 거쳐 평가를 완료한 **autoritative(공식)** 최종 downstream LSTM 성능 분석 결과이다. (기본 임계값 threshold=0.5)

*   **Accuracy**: 0.773186
*   **Precision**: 0.738662
*   **Faint Recall**: 0.774547
*   **F1-score**: 0.756179
*   **Confusion Matrix**:
    *   True Normal, Pred Normal (TN): 2,713
    *   True Normal, Pred Faint (FP): 801
    *   True Faint, Pred Normal (FN): 659
    *   True Faint, Pred Faint (TP): 2,264

#### 최종 YOLO26n-pose 임계값(Threshold) 감사 결과
Faint 탐지(Recall) 최우선 확보와 현장 오탐(FP) 제어 사이의 균형점을 선택하기 위한 임계값 세부 지표이다.

| Threshold | Faint Recall | Precision | F1-score | Predicted Normal | Predicted Faint | 해석 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **0.3** | 0.846391 | 0.659382 | 0.741273 | 2,685 | 3,752 | 미탐 최소화 (가장 높은 Recall), 단 오탐 위험성 증가 |
| **0.4** | 0.805337 | 0.696862 | 0.747183 | 3,059 | 3,378 | Recall 80% 방어 수준의 운영 후보 |
| **0.5** | 0.774547 | 0.738662 | 0.756179 | 3,372 | 3,065 | **현재 기본 비교값 및 균형 임계값** |
| **0.6** | 0.702703 | 0.768713 | 0.734227 | 3,765 | 2,672 | 오탐 억제형 운영 후보 |
| **0.7** | 0.597674 | 0.784463 | 0.678447 | 4,210 | 2,227 | 미탐 증가로 실전 배포 시 위험 수준 |

---

### 2. Fast 6-Model Downstream Comparison (소규모 빠른 검증용 split)
비교 대상 6개 YOLO pose extractor 모델에 대하여 소규모 검증 split에서 downstream LSTM 판정을 테스트한 Reference 데이터 지표이다. (기본 임계값 threshold=0.5)

| Model | Eval Normal | Eval Faint | Pred Normal | Pred Faint | FP | FN | Recall | Precision | F1 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **yolo26n-pose** | 785 | 570 | 527 | 828 | 400 | 142 | 0.750877 | 0.516908 | 0.612303 |
| **yolo26s-pose** | 846 | 745 | 707 | 884 | 390 | 251 | 0.663087 | 0.558824 | 0.606507 |
| **yolo11n-pose** | 748 | 569 | 707 | 610 | 236 | 195 | 0.657293 | 0.613115 | 0.634436 |
| **yolo11s-pose** | 736 | 547 | 736 | 547 | 228 | 228 | 0.583181 | 0.583181 | 0.583181 |
| **yolov8n-pose** | 773 | 605 | 879 | 499 | 181 | 287 | 0.525620 | 0.637275 | 0.576087 |
| **yolov8s-pose** | 828 | 707 | 1255 | 280 | 82 | 509 | 0.280057 | 0.707143 | 0.401216 |

---

## 입력

- Pose model: `yolo26n-pose.pt`, `yolo26s-pose.pt`, `yolo11n-pose.pt`, `yolo11s-pose.pt`, `yolov8n-pose.pt`, `yolov8s-pose.pt`
- LSTM 입력: keypoint sequence
- 클래스: `Normal`, `Faint`
- 최종 평가 로그: `gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json`
- 소규모 비교 평가 결과: `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`

## 출력

- 모델별 Recall, Precision, F1, Accuracy
- FP/FN confusion matrix 해석
- `yolo26n-pose` 최종 threshold 후보 세부 감사 정보

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

- `gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json`
- `gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/confusion_matrix.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/yolo26n-pose/summary.json`
- `docs/wiki/data/modelMetrics.json`
- `strange_ai/ai/action/motion_features.py`

## 관련 문서

- [LSTM](LSTM.md)
- [Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md)
- [LSTM-Sequence-Length-Comparison](LSTM-Sequence-Length-Comparison.md)
- [Model-Comparison](Model-Comparison.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)

## 주의사항

최종 감사(Split Test Audit) 결과 threshold 0.3 이나 0.4는 Recall 방어(최대 0.846)에는 우수하나, Faint 예측으로 떨어지는 횟수가 다소 많다(예: 0.3일 때 3,752회). 실제 현장 배포 시에는 consecutive-Faint 판정 및 카메라 단위 cooldown 설정 등 2차 필터(post-processing) 설정을 반드시 동반하여 오알림을 차단해야 한다.

## 후속 작업

- 운영 후보 threshold인 0.4와 0.5를 기준으로 RTSP/WebRTC 통합 시뮬레이션을 실행하여 실시간 알림 오발송 빈도를 측정한다.
- consecutive-Faint 판단 횟수 파라미터가 관제 피로도와 검출 지연 시간에 미치는 다차원 영향을 추가 평가한다.

---
#lstm #experiment-results #threshold #model-comparison #yolo26n #split-test-audit
