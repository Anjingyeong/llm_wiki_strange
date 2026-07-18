---
title: "Track ID 파편화 완화: Offline 성공·Live Canary 부분 성공"
navTitle: "Track ID 파편화"
shortTitle: "Tracking Canary"
displayTitle: "트래킹 Association 안정화 실험"
category: Evidence
tags: [tracking, association, offline-ab, simple-tracker, iou, multi-det]
relatedDocs: [Tracking-Association-Offline-AB-2026-07-13, Bug-AI-Tracker-FrameRate-Mismatch, AI-Pipeline]
relatedFiles: [strange_ai/scripts/replay_tracking_from_cache.py, strange_ai/scripts/multi_person_proxy_from_cache.py, strange_ai/scripts/eval_two_person_synthetic_gt.py, strange_ai/tracking/simple_tracker.py, strange_ai/ai/postprocess/supervision_postprocessor.py, strange_ai/tests/test_tracking_ab_replay.py]
updatedAt: 2026-07-15
project: smart-safety-ai
type: experiment
status: partial
evidenceLevel: live-canary
summary: "offline A/B에서는 Track ID 파편화를 줄였지만 live canary 목표를 충족하지 못해 rollback했고, 전역 rollout은 HOLD 상태다."
relations: [depends-on:Tracking-Association-Offline-AB-2026-07-13, related:AI-Pipeline]
productionStatus: rollback
canonicalFor: tracking-association
portfolio_use: true
order: 261
---

> **한 줄 결과:** Offline A/B에서 near-duplicate mint 억제로 new/lost=0·retention≈0.999를 달성했으나, cam_03 live canary는 new/lost 목표 미달 → **PARTIAL**, rollback 후 **전역 rollout HOLD**.

## 현재 상태 (읽기 순서)

| 항목 | 값 |
|------|-----|
| `status` | **partial** |
| `evidenceLevel` | live-canary |
| `productionRollout` | **held** (global default none) |
| Offline A/B | PASS (hybrid_kp M) |
| Live cam_03 canary | FAIL new/min·lost/min 목표 → rollback 실행 |

## 1. 문제 정의

실시간 Faint 관제 시스템에서 화면에 사람이 지속 존재함에도 불구하고 객체 검출 실패(Miss), 가림(Occlusion), 또는 급작스러운 움직임으로 인해 Track ID가 반복 재발급되는 파편화(ID Fragmentation)가 발생하였습니다.
이로 인해 하나의 행동 흐름(Fall/Faint sequence)이 쪼개지고, 경보 알림 라이프사이클이 오작동하여 관제 피로도 증가와 데이터 왜곡을 유발하였습니다.

## 2. 실제 관찰 및 원인

- **NMS Near-Duplicate Box**: YOLO 추론 직후 NMS(Non-Maximum Suppression) 단계에서 동일 대상에 대해 매우 미세한 차이를 가진 중복 Box(IoU >= 0.7)가 잔존하여, 트래커(Simple Tracker) 유입 시 하나의 Box만 기존 트랙에 매칭되고 나머지 하나는 `MULTI_DET_EXTRA` 신규 트랙으로 발급(unmatched mint)되어 Track ID가 과도하게 Churn되는 현상을 규명하였습니다.
- **가림 후 재연결 시 Motion Spike**: 쓰러짐Suspected 트랙이 수 프레임 단절되었다가 ROI 가속 감지(Incident Recovery) 또는 일반 IoU relink를 통해 복구/재연결될 때, 유실 구간 동안 누적된 displacement로 인해 동적 움직임 속도(`velocity`, `center_drop`) 피처에 왜곡된 수치 튀어오름(Motion Spike)이 발생해 잘못된 실신 판정으로 이어지는 부작용을 확인하였습니다.

## 3. 내가 한 판단

- **Claimed Near-Duplicate Mint Suppression (mode=hybrid_kp) 도입**: NMS 중복 박스가 발생해도 이미 고신뢰도의 박스가 트랙을 매칭(Claim)했다면, 그와 IoU가 겹치는 2차 박스의 신규 트랙 민팅(Mint)을 강제 Suppress하도록 설계하였습니다.
- **트랙 상태 마이그레이션 시 시퀀스 프레시 스타트(Sequence Fresh Start)**: Incident Recovery 성공으로 트랙 ID를 교체/복구할 때, 기존 keypoint history를 강제 클리어(`fresh_start_history=True`)하여 유실 윈도우 사이의 잘못된 프레임 연결을 물리적으로 차단하였습니다.
- **불연속 구간 속도 강제 마스킹(Velocity Discontinuity Mask)**: 일반 tracker relink 혹은 대량의 프레임 격차 발생 상황을 마스킹하여 해당 시점의 모션 속도 피처를 0으로 강제 캘리브레이션하였습니다.
- **wrong relink의 identity GT 평가 격리**: wrong relink 카운터 측정은 identity ground truth 데이터가 확보된 경우에 한정하여 `evaluated`로 수집하고, 미비 시에는 `not_evaluated`로 안전하게 마크하여 통계 왜곡을 방지하였습니다.

## 4. 구현 및 검증

develop 런타임에 개선 로직이 탑재되어 있으며, **Offline replay A/B**와 **단위 테스트**는 통과했다. **전역 운영 배포는 live canary 결과에 따라 보류 중**이다.

### 4.1 일반 Tracker Relink 매개변수 사양
- `tracking_relink_iou_threshold`: 0.10 ~ 0.45 (일반 IoU 및 중심 거리에 따른 재연결 지원)
- `tracking_relink_max_time_gap_seconds`: 최대 3.0초 이내 유실 시 재연결 허용

### 4.2 Incident Recovery 가속 감지 사양
- **가동 트리거**: 쓰러진(Faint/Fall Suspected) 트랙이 연속 **2프레임** 유실될 경우 기동.
- **ROI 확장 비율**: Left +50%, Right +50%, Down +60%, Up +15% 확대 추론.
- **추론 매개변수**: conf=0.05, imgsz=640 으로 최저 검출률 극대화.
- **복구 마이그레이션**: `finalize_recovery_detections` 호출을 통해 새로 발급된 신규 Track ID로 display_id 및 post_processor 라이프사이클 이관 연동 완료.

### 4.3 불연속 스파이크 방지 검증 (`build_motion_discontinuity_mask`)
`recovery_relink` 또는 `motion_discontinuity` 플래그 발생 시 모션 변화량을 0으로 클리어하는 마스킹 로직 검증 결과입니다.

| 벤치마크 구성 | new/min | lost/min | MULTI_DET_EXTRA | dup frames | unique pairs | retention | suppress | ghost max |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Baseline A | 3.50 | 3.50 | 7 | 135 | 7 | 0.382 | 0 | 3.00s |
| **hybrid_kp M (적용)** | **0** | **0** | **0** | **0** | **0** | **0.999** | **24** | **0** |

M 설정을 적용했을 때 unmatched mint에 따른 MULTI_DET_EXTRA 중복 트랙 및 훼손 프레임(duplicate/ghost)이 0건으로 상쇄되어 완벽한 추적 일관성(retention 0.999)을 회복하였습니다.

### 4.4 Canary 배포 실전 검증 (live cam_03)
실제 4채널 카메라 스트리밍 런타임 상에서 동작 유효성 비교 결과입니다.

- **analysis FPS**: 28.99 ➡ **29.03** (추가 연산 부하 미비, 연산 효율성 PASS)
- **new/min (ID churn)**: 4.25 ➡ **1.75** (**약 59% 감소**)
- **lost/min (ID loss)**: 3.75 ➡ **1.62** (**약 57% 감소**)
- **duplicate_frames**: 239 ➡ **75** (분당 dup 환산 시 약 84% 감소)
- **ghost max**: 1.3초 ➡ **0초** (완전 소멸)

---

## 5. 한계 및 후속 작업

### 한계
- **wrong_relink GT 평가 한계**: 현장에서 identity ground truth가 주어지지 않은 영상의 경우, wrong relink는 `not_evaluated`로 처리되므로 실질적인 오연결 비율에 대한 정밀 평가는 현장 수동 라벨이 축적된 후 판단해야 합니다.
- **실영상 2인 교차 검증 부족**: 카나리 셋업은 단일 및 분리 보행 시나리오 위주로 검증되어 복잡한 occlusion 환경에서의 다중 suppress 검증은 추가 현장 모니터링이 필요합니다.

### 후속 작업
- **wrong relink GT 데이터 수집**: real-world sequence에서 wrong relink 여부를 평가할 수 있는 identity annotation 세트를 추가 구축합니다 (미완료/후속 계획).
- **consecutive-Faint Cooldown 연계**: ID 스위칭이 최소화된 안정된 트랙 상에서 Faint 알림 Cooldown 파라미터를 추가 튜닝합니다.

---
#tracking #association #relink #incident-recovery #discontinuity-mask #evidence
fline M 설정은 new/lost=0·retention≈99.9%였지만 실제 multi-object 회귀 위험이 남아 있었다.

판단: 전역 배포 대신 cam_03 한 대에만 `hybrid_kp` + `new_track_thresh=0.30` canary를 적용해 live analysis FPS·ID·suppression을 확인했다.

근거: synthetic 2인 hijack/wrong-suppress=0이었으나 실 2인 교차 GT는 미완.

결과: live 8분 canary 창에서 suppression은 동작(suppress≈60)했고 FPS≈29를 유지했으나 new/min·lost/min·MULTI_DET_EXTRA 목표 미달 → **PARTIAL, cam_03 rollback 실행, GLOBAL HOLD**.

### Baseline vs Canary (live cam_03)

| 지표 | baseline (~4min) | canary (~8min) | 개선 | 판정 |
|---|---:|---:|---:|---|
| analysis FPS | 28.99 | 29.03 | 유지 | PASS ≥27 |
| new/min | 4.25 | 1.75 | ↓59% | FAIL ≤1 |
| lost/min | 3.75 | 1.62 | ↓57% | FAIL ≤1 |
| MULTI_DET_EXTRA | 13 | 7 | ↓ | FAIL ≤1/10min |
| duplicate_frames | 239 | 75 | ↓69% abs | FAIL 80%↓ 기준 미달* |
| ghost max | 1.3s | 0s | 개선 | PASS |
| retention proxy | 0.64 | 0.80 | 개선 | 개선 |
| suppressed | 0 | 60 | 동작 확인 | — |

\* 분당 dup 환산 시 baseline≈60/min → canary≈9/min (≈84%↓) 로 해석 가능하나 절대 프레임 기준 80% 목표 판정은 보수적으로 FAIL.

### 안전장치

- per-camera flag (`ai/tracking_canary.py` + worker env)
- cam_03 only kill/respawn
- rollback: `clear_canary_config` + cam_03 overlay restart
- global default 유지
- 실제 2인 검증 전 rollout HOLD

### 포트폴리오용 요약

Track ID churn residual은 offline에서 true IoU miss가 아니라 YOLO near-duplicate mint로 재정의되었다. hybrid_kp suppression을 설계해 offline A/B에서 new/lost=0까지 만들었지만, 실서비스 전역 배포 대신 cam_03 canary로 live 검증했다. canary는 analysis FPS≈29와 ghost 0·suppress 동작을 확인했으나 new/lost 목표 미달로 PARTIAL 판정 후 cam_03을 즉시 rollback했고 전역 default는 none을 유지했다.

## Determinism evidence

Two offline runs of `A_current` on the same cache:

- `frame_results.jsonl`: **bit-identical**
- `switch_events.jsonl`: **bit-identical**
