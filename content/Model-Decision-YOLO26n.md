---
title: "Model Decision YOLO26n (Redirect)"
navTitle: "YOLO26n 결정 (이동)"
shortTitle: "YOLO26n redirect"
category: Experiments
status: archived
redirectTo:
  - Model-Comparison
  - ADR-003-YOLO26n-Selection
updatedAt: 2026-07-15
portfolio_use: false
---

# 이 문서는 Canonical 문서로 통합되었습니다

동일 결론이 세 문서에 반복되어 검색·RAG 노이즈가 커졌습니다. 아래만 읽으면 됩니다.

1. **실험·수치:** [Model-Comparison](Model-Comparison.md) — Faint Recall, F1, Seed 표준편차
2. **결정 기록:** [ADR-003-YOLO26n-Selection](ADR-003-YOLO26n-Selection.md) — 왜 26n인가, 부작용, 후속

## 이전 요약 (보존)

- 기본 모델: `YOLO26n-pose`
- 기준: Accuracy/단순 FPS보다 **Faint Recall**, downstream LSTM, seed 안정성

후속: Hard-negative 재학습, consecutive-Faint 조율 → 각 Canonical 문서 § 후속 작업 참고.
