---
title: "LSTM 입력 54D 확장: 벤치 채택·운영 승격 보류"
navTitle: "54D 확장 ADR"
shortTitle: "ADR-004"
category: ADR
relatedDocs: [Feature-Vector-51D-vs-54D, LSTM, AI-Pipeline]
relatedFiles: [strange_ai/ai/action/motion_features.py, strange_ai/ai/action/classifier.py]
updatedAt: 2026-07-15
type: decision
status: partial
evidenceLevel: offline-benchmark
canonicalFor: lstm-feature-54d
---

> **결정:** 런타임·학습 파이프라인은 54D 스키마를 **목표 규격**으로 채택했으나, Zero Padding fallback·스키마 혼용 리스크로 **production 승격은 보류**합니다. 수치 근거는 [Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md)가 Canonical입니다.

## 1. 목적

LSTM keypoint input을 순수 51D에서 54D로 확장한 구조를 의사결정 기록으로 남긴다.

## 2. 배경

실신은 정적인 자세뿐 아니라 시간에 따른 중심 하강, 속도, 몸통 기울기 변화가 중요한 신호다. 따라서 keypoint 좌표만 쓰는 51D보다 간단한 motion feature를 붙인 54D가 더 많은 행동 단서를 담을 수 있다.

## 3. 핵심 내용

*   **Decision**: 기본 LSTM 입력 목표는 54차원(`KEYPOINT_MOTION54_SCHEMA_VERSION` / `KEYPOINT_BBOX54_SCHEMA_VERSION`)이다.
*   **상태**: **부분 검증 (partial)** — 오프라인 벤치에서 F1·FP/FN 개선은 확인했으나, 캐시·학습 파이프라인 정리 전까지 **실운영 단일 모델로 승격하지 않는다**.
*   **성능 세부 지표**: [Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md) 참고.

## 4. 후속 작업

*   **Zero Padding Fallback 제거**: 학습 및 캐시 빌드 단계에서 51D ➡ 54D 묵시적 Zero Padding Fallback을 차단하고 Hard Fail(ValueError)로 전환하여 런타임 스키마 안정성 확보.

---
#adr #lstm #feature-expansion #54d #motion-feature
