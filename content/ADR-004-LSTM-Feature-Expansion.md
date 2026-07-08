---
title: ADR-004 LSTM Feature Expansion
navTitle: ADR-004
shortTitle: ADR-004
category: ADR
relatedDocs: [Feature-Vector-51D-vs-54D, LSTM, AI-Pipeline]
relatedFiles: [strange_ai/ai/action/motion_features.py, strange_ai/ai/action/classifier.py]
updatedAt: 2026-06-26
---

## 목적

LSTM keypoint input을 순수 51D에서 54D로 확장한 구조를 의사결정 기록으로 남긴다.

## 배경

실신은 정적인 자세뿐 아니라 시간에 따른 중심 하강, 속도, 몸통 기울기 변화가 중요한 신호다. 따라서 keypoint 좌표만 쓰는 51D보다 간단한 motion feature를 붙인 54D가 더 많은 행동 단서를 담을 수 있다.

## 핵심 내용

Decision:

- 현재 keypoint LSTM 경로는 54D feature를 사용한다.
- 54D는 51D keypoint feature에 `center_drop`, `velocity`, `torso_angle`을 추가한 구조다.
- 51D와 54D의 성능 비교 수치는 현재 로컬 artifact에서 미확인이다.

## 입력

- 17개 keypoint의 normalized x/y/confidence
- shoulder midpoint
- hip midpoint

## 출력

- `(sequence_length, 54)` LSTM feature

## 동작 흐름

```text
51D keypoint features
-> append_motion_features
-> center_drop, velocity, torso_angle
-> 54D LSTM input
```

## 관련 파일

- `strange_ai/ai/action/motion_features.py`
- `strange_ai/ai/action/classifier.py`
- `strange_ai/benchmark/compare_lstm_extractors.py`

## 관련 문서

- [Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md)
- [LSTM](LSTM.md)
- [AI-Pipeline](AI-Pipeline.md)

## 주의사항

feature 확장이 항상 성능 개선을 보장하지는 않는다. 54D 구조는 확인됐지만, 51D baseline과 같은 조건의 성능 비교는 아직 미확인이다.

## 후속 작업

51D/54D ablation benchmark를 추가하고 `Feature-Vector-51D-vs-54D.md`에 수치와 선택 이유를 갱신한다.

---
#adr #lstm #feature-expansion #54d #motion-feature
