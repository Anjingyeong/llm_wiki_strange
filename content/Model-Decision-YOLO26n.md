---
title: Model Decision YOLO26n
navTitle: YOLO26n 결정
shortTitle: YOLO26n 결정
category: Experiments
relatedDocs: [AI-Pipeline, LSTM, Model-Comparison, Benchmark-History]
relatedFiles: [docs/MODEL_BENCHMARK_REPORT.md, docs/AI_TRAINING_DIRECTION.md, docs/wiki/data/modelMetrics.json]
updatedAt: 2026-07-14
project: smart-safety-ai
type: model-decision
portfolio_use: true
---

## 1. 목적

YOLOv8n, YOLOv11n, YOLO26n, YOLOv8s 계열 pose 모델 비교 결과와 `YOLO26n-pose` 선택 이유를 기록한다.

## 2. 배경

관제 시스템에서 pose extractor는 단독 모델이 아니라 LSTM 이벤트 판단 앞단이다. 좋은 extractor는 단순히 빠른 모델이 아니라, 실신 클래스에 유효한 keypoint sequence를 안정적으로 만들어야 한다.

## 3. 핵심 내용

*   **기본 모델**: `YOLO26n-pose` (`yolo26n-pose.pt`)
*   **의사결정 판단**: Accuracy나 단순 속도보다는 **Faint Recall**과 **Downstream LSTM 성능** 및 **Seed 반복 안정성**을 기준으로 최종 선정하였습니다.
*   **성능 비교**: 상세 비교 수치 및 표는 Canonical 문서인 **[Model-Comparison](Model-Comparison.md)**을 참고하시기 바랍니다.

## 4. 후속 작업

*   **Hard-Negative 재학습**: 현장에서 발생하는 오탐을 수집하여 LSTM 가중치를 미세조정하는 self-improving 루프 구축 (미완료/후속 과제).
*   **consecutive-Faint 판정 조율**: 후처리 단에서 연속 검출 기준 프레임을 높여 오알림 품질을 개선.

---
#model-decision #yolo #benchmark #faint-recall #evidence
