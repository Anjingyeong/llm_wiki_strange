---
title: LSTM Experiment Results
navTitle: "LSTM 결과"
shortTitle: "LSTM 결과"
category: AI Pipeline
relatedDocs: [LSTM, Model-Comparison, Benchmark-History]
relatedFiles: [.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv, docs/wiki/data/modelMetrics.json, gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json]
updatedAt: 2026-07-14
type: experiment
status: partial
evidenceLevel: offline-benchmark
---

## 1. 문제 정의

Pose Extractor가 생성한 관절 시퀀스의 변동성(Keypoint Noise)과 시드 초기값 편차가 다운스트림 LSTM Faint 분류기의 성능 및 현장 알림 안정성을 저해하는 문제를 해결해야 합니다.
동일 데이터셋에서 초기 가중치 시드에 따라 최종 성능 편차가 심한 문제를 최소화하고, 안정적인 탐지 성능을 보장하는 모델 환경을 정의해야 합니다.

## 2. 실제 관찰 및 원인

초기 51차원 keypoint sequence만을 학습된 LSTM에 입력했을 때, 정적 좌표 정보만으로는 사람이 서서 쓰러지는 동작(Faint)과 일반적인 앉기/눕기 상태를 구별하기 어려운 한계가 관찰되었습니다.
또한, 학습 시드(Seed 42, 43, 44)를 바꿀 때마다 LSTM 분류기 성능 편차가 최대 8%p 이상 발생하는 등 초기값에 크게 의존하는 우연성 결과가 존재하였습니다.

## 3. 내가 한 판단

1. **YOLO26n-pose 기반 학습 최적화**: 다운스트림 LSTM 시퀀스를 가장 안정적으로 유도하는 YOLO26n-pose를 Extractor로 선정하였습니다.
2. **Stratified Source Video Split 기반 평가**: 단순 임의 분할 대신 카메라 장소 및 소스 비디오 단위로 분리된 대규모 공식 평가 셋을 구축하여 신뢰도를 검증하였습니다.
3. **무작위 시드 반복 및 Threshold Sweep 검증**: 우연한 가중치 학습을 배제하기 위해 다중 시드 평균값과 임계값 그리드 스윕을 명시적으로 평가 지표에 편입하였습니다.

## 4. 구현 및 검증

현재 develop 런타임은 시퀀스 누적 길이 30, 스트라이드 15(`sequence_length=30`, `sequence_stride=15`) 및 입력 특징 규격 54차원을 준수하여 동작합니다.

### 4.1 최종 YOLO26n-pose Split Test Audit (최종 대규모 데이터셋)
전체 데이터셋(Stratified Source Video Split 기준: train 14,068 / val 3,042 / test 2,784)에 대하여 `Oversample` 처리를 거쳐 평가를 완료한 **공식(Authoritative)** 최종 downstream LSTM 성능 분석 결과입니다. (기본 임계값 threshold=0.5)

*   **Accuracy**: 0.773186
*   **Precision**: 0.738662
*   **Faint Recall**: 0.774547
*   **F1-score**: 0.756179
*   **Confusion Matrix**:
    *   True Normal, Pred Normal (TN): 2,713
    *   True Normal, Pred Faint (FP): 801
    *   True Faint, Pred Normal (FN): 659
    *   True Faint, Pred Faint (TP): 2,264

### 4.2 최종 YOLO26n-pose 임계값(Threshold) 감사 결과
Faint 탐지(Recall) 최우선 확보와 현장 오탐(FP) 제어 사이의 균형점을 선택하기 위한 임계값 세부 지표입니다.

| Threshold | Faint Recall | Precision | F1-score | Predicted Normal | Predicted Faint | 해석 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **0.3** | 0.846391 | 0.659382 | 0.741273 | 2,685 | 3,752 | 미탐 최소화 (가장 높은 Recall), 단 오탐 위험성 증가 |
| **0.4** | 0.805337 | 0.696862 | 0.747183 | 3,059 | 3,378 | Recall 80% 방어 수준의 운영 후보 |
| **0.5** | 0.774547 | 0.738662 | 0.756179 | 3,372 | 3,065 | **현재 기본 비교값 및 균형 임계값** |
| **0.6** | 0.702703 | 0.768713 | 0.734227 | 3,765 | 2,672 | 오탐 억제형 운영 후보 |
| **0.7** | 0.597674 | 0.784463 | 0.678447 | 4,210 | 2,227 | 미탐 증가로 실전 배포 시 위험 수준 |

### 4.3 Pose Extractor 연계 LSTM 비교 지표
다양한 YOLO Pose Extractor가 생성한 시퀀스를 기반으로 학습된 다운스트림 LSTM의 6개 모델 간 세부 벤치마크 및 비교 수치는 **[Model-Comparison](Model-Comparison.md)**을 참고하시기 바랍니다.

---

## 5. 한계 및 후속 작업

### 한계
- 임계값 0.3~0.4 설정 시 높은 Recall을 달성하지만 Faint 예측 발령 횟수가 많아 현장 오경보 피로도가 높습니다.
- consecutive-Faint 조건(연속 1, 2, 3회 검출 기준)과 연계되어 필터링 성능을 확보해야 합니다.

### 후속 작업
- **Hard-Negative 훈련 기법별 비교**: `54차원 + Hard-Negative 5%, 10%, 20%` 등 오류 마이닝 데이터를 주입한 재학습 모델을 비교 평가해야 합니다 (후속 계획).
- **VLM side-channel 연동**: 복합 행동 판독을 위한 VLM Snapshot 분석 연동을 고도화합니다 (현재 미적용).

---
#lstm #experiment-results #threshold #model-comparison #yolo26n #split-test-audit
