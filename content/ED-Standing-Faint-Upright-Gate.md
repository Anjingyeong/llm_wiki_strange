---
title: "서 있는 사람을 쓰러짐으로 오판한 원인과 자세 전이 Gate 적용"
navTitle: "Standing Faint Gate"
shortTitle: "Upright Gate"
category: AI Pipeline
type: decision
status: partial
evidenceLevel: unit-test
canonicalFor: standing-faint-fp
relatedDocs:
  - ED-Fall-Faint-Lifecycle
  - Feature-Vector-51D-vs-54D
  - Tracking-Association-Stabilization
relatedFiles:
  - strange_ai/ai/action/fall_event_state.py
  - strange_ai/ai/action/faint_post_processing.py
  - strange_ai/ai/action/posture_estimator.py
  - strange_ai/tests/test_standing_faint_block.py
  - strange_ai/tests/test_fall_event_state_machine.py
updatedAt: 2026-07-15
portfolio_use: true
prRefs:
  - strangeRookies/ai#83
---

> **한 줄 결과:** LSTM이 **서 있는 자세(`upright_like`)** 에서 Faint를 내도, **upright→lying 전이 없이는 `NEW_FALL` 확정·MQTT 사고 승격 경로를 차단**했다. **단위 테스트로 논리 경로 차단은 검증**했으나 **대표 영상셋 FP 감소율·Recall 손실은 미검증**이다.

## Situation

- Pose+LSTM 파이프라인이 **서 있는 작업자**에게 간헐적으로 높은 Faint 확률을 부여할 수 있다.
- 기존 흐름에서는 그 신호가 **연속 카운터·lifecycle `NEW_FALL`** 로 이어져 “쓰러짐 의심” 이벤트가 발행될 수 있다.
- 관제에서는 **오탐 한 건**이도 피로도와 신뢰도에 치명적이다.

## Task

- **서 있는 채 Faint** 가 곧바로 **신규 낙상(`NEW_FALL`)** 으로 승격되지 않게 할 것.
- 정상적인 **서 있음 → 쓰러짐** 시퀀스는 계속 허용할 것.
- 차단 시 **consecutive 카운터가 누적되지 않게** 할 것.

## Action

### 원인 (논리)

- 자세 추정(`posture_estimator`)이 `upright_like` / `lying_like` / `unknown` 을 구분한다.
- `upright_to_lying` 은 최근 upright 윈도우 후 lying 전환일 때만 true.
- LSTM Faint와 자세 신호가 **독립**이라, upright 상태에서도 alert가 올 수 있다.

### 판단

1. **State machine** (`FallEventStateMachine`, `block_upright_faint`): 현재 `upright_like` 이고 `upright_to_lying` 없으면 **`NEW_FALL` 후보 자체를 NONE / blocked** 로 처리.
2. **Post-processor** (`FaintEventPostProcessor`): `standing_blocked` 시 `effective_alert=False`, consecutive 리셋, lifecycle revert 경로.
3. **런타임 기본값**: `BLOCK_UPRIGHT_FAINT=true` (`rtsp_inference_args.py` / env).

### 핵심 코드

- `fall_event_state.py` — `blocked_currently_upright_without_transition`
- `faint_post_processing.py` — `standing_blocked`, diagnostic `standing_blocked=true` 로그
- `posture_estimator.py` — `upright_like`, `upright_to_lying`

## Result

### 검증 완료

- `tests/test_standing_faint_block.py`: upright + Faint ×2 → **emit 없음**, consecutive 미누적.
- `tests/test_standing_faint_block.py`: upright → lying 전이 후 Faint → **`NEW_FALL` 허용**.
- `tests/test_fall_event_state_machine.py`: lifecycle·미회복·cooldown 기존 계약 유지.

### 부분 검증

- PR #83: 기존 오판 시나리오에서 **이벤트 승격 흐름이 막히는지** 정성 확인 (저장소 PR 본문·Evidence 참고).

### 미검증

- 고정 **영상셋** 기준 FP 건수 Before/After.
- Gate 적용 후 **Recall/FN** 변화 (서 있음에서의 미탐).

표현 주의: 수치 없이 “오탐 개선”을 단정하지 말고, **“서 있는 Faint가 사고 이벤트로 승격되는 논리 경로를 차단”** 으로 기술한다.

## Evidence

- `strangeRookies/ai#83`
- `ai/tests/test_standing_faint_block.py`
- `ai/docs/FALL_EVENT_LIFECYCLE_MQTT_CONTRACT.md` — `postureLabel`, `NEW_FALL` 1회 규칙

## 한계와 다음 실험

- LSTM 자체 FP는 Gate로만 막지 않음 — hard-negative·motion gating(`motion_valid_ratio`) 병행.
- 대표 클립 N개에 대해 FP/FN 표를 Result에 추가할 것.
