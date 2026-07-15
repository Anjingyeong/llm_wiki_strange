---
title: ADR-004 LSTM Feature Expansion
navTitle: ADR-004
shortTitle: ADR-004
category: ADR
relatedDocs: [Feature-Vector-51D-vs-54D, LSTM, AI-Pipeline]
relatedFiles: [strange_ai/ai/action/motion_features.py, strange_ai/ai/action/classifier.py]
updatedAt: 2026-07-14
---

## 1. 목적

LSTM keypoint input을 순수 51D에서 54D로 확장한 구조를 의사결정 기록으로 남긴다.

## 2. 배경

실신은 정적인 자세뿐 아니라 시간에 따른 중심 하강, 속도, 몸통 기울기 변화가 중요한 신호다. 따라서 keypoint 좌표만 쓰는 51D보다 간단한 motion feature를 붙인 54D가 더 많은 행동 단서를 담을 수 있다.

## 3. 핵심 내용

*   **Decision**: 기본 LSTM 입력은 54차원(`KEYPOINT_MOTION54_SCHEMA_VERSION` 및 `KEYPOINT_BBOX54_SCHEMA_VERSION`)을 기본 스키마 규격으로 사용합니다.
*   **상태**: **검증 완료 (Verified)**. 54D 확장을 통하여 F1-score가 89.29%에서 93.49%로 향상되었으며, FP 및 FN이 각각 약 38% 수준 대폭 감소했음을 확인하였습니다.
*   **성능 세부 지표**: 상세 성능 비교와 54D의 세부 수치(center_drop, velocity, torso_angle 등)는 Canonical 문서인 **[Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md)**를 참고해 주시기 바랍니다.

## 4. 후속 작업

*   **Zero Padding Fallback 제거**: 학습 및 캐시 빌드 단계에서 51D ➡ 54D 묵시적 Zero Padding Fallback을 차단하고 Hard Fail(ValueError)로 전환하여 런타임 스키마 안정성 확보.

---
#adr #lstm #feature-expansion #54d #motion-feature
