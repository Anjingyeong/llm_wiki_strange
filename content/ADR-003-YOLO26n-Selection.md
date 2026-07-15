---
title: ADR-003 YOLO26n Selection
navTitle: ADR-003
shortTitle: ADR-003
category: ADR
relatedDocs: [Model-Comparison, Model-Decision-YOLO26n, LSTM-Experiment-Results]
relatedFiles: [docs/wiki/data/modelMetrics.json, .tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv]
updatedAt: 2026-07-14
---

## 1. 목적

Pose extractor 기본 후보를 `yolo26n-pose`로 유지하는 결정을 기록한다.

## 2. 배경

실신 감지는 precision만 높은 모델보다 Faint Recall이 높은 모델이 운영상 유리하다. 놓친 실신은 관제 공백으로 이어지지만, 오탐은 cooldown, scope, 후처리 정책으로 일부 완화할 수 있다.

## 3. 핵심 내용

*   **Decision**: 기본 pose extractor는 `yolo26n-pose.pt`로 결정하고, 가용 백엔드는 TensorRT(실행 시 선택) 및 PyTorch Fallback(안정 기본 탑재)을 유지합니다.
*   **선택 기준**: `Faint Recall` 1순위, `F1-Score` 2순위, `무작위 시드 반복 시 성능 편차 최소화` 3순위.
*   **성능 비교**: 상세 비교 수치 및 표는 Canonical 문서인 **[Model-Comparison](Model-Comparison.md)**을 참고하시기 바랍니다.

## 4. 후속 작업

*   **오탐 수집 및 Hard-Negative 훈련**: 운영 중 수집된 FP(오탐) 데이터를 기반으로 downstream LSTM을 추가 튜닝하는 개선 과제 수립.

---
#adr #yolo26n #model-selection #benchmark #faint-recall
