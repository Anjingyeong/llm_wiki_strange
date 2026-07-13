---
title: Tracking Association Stabilization
navTitle: "Track Association"
shortTitle: "Track Assoc"
displayTitle: "트래킹 Association 안정화 실험"
category: Evidence
tags: [tracking, association, offline-ab, simple-tracker, iou, multi-det]
relatedDocs: [Tracking-Association-Offline-AB-2026-07-13, Bug-AI-Tracker-FrameRate-Mismatch, AI-Pipeline]
relatedFiles:
  - strange_ai/scripts/replay_tracking_from_cache.py
  - strange_ai/scripts/multi_person_proxy_from_cache.py
  - strange_ai/scripts/eval_two_person_synthetic_gt.py
  - strange_ai/tracking/simple_tracker.py
  - strange_ai/ai/postprocess/supervision_postprocessor.py
  - strange_ai/tests/test_tracking_ab_replay.py
updatedAt: 2026-07-13
project: smart-safety-ai
type: experiment-report
portfolio_use: true
order: 261
---

# 트래킹 Association 안정화 실험

## 1. 문제 정의

화면에 사람이 지속 존재해도 Track ID가 반복 재발급되어 Fall/Faint sequence가 쪼개지고 이벤트 lifecycle이 분리된다.

분리한 문제:

- **FPS/publisher 병목** → 이미 해결 (15→30 analysis)
- **EXIT outside-only 오표시** → edge-trigger로 FP 0
- **true IOU association miss** → offline cache에서 **0** (라벨 교정 후)
- **남은 residual → MULTI_DET_EXTRA** → YOLO near-duplicate box + tracker mint 정책

운영 영향: sequence fragmentation, 이벤트 중복, VLM/incident 연결 오류 위험.

## 2. 기존 판단과 발견

| 초기 가설 | 실측 결과 |
|---|---|
| YOLO miss | det_rate ≈ 1.0 → **기각** |
| ByteTrack 파라미터만 문제 | 실제는 **stability_fallback → SimpleTrackAssigner** |
| predicted_bbox 폭주 | live에서 확인 후 clamp/dt 수정 |
| publisher fps=15 | analysis를 15로 묶음 → **fps=30 교정** |
| residual = IoU threshold | **부분 기각**: 고정 cache에서 true `IOU_BELOW_THRESHOLD=0` |
| residual = multi-det mint | **채택**: NMS 출력부터 near-dup 존재 + tracker unmatched mint |

### 2.1 Near-duplicate 발생 레이어 (frame 124 / 565)

| 단계 | 관찰 |
|---|---|
| Ultralytics/NMS output | **이미 2 boxes** (cache = detector 직후 저장) |
| person filter / pose postprocess | 중복 append 없음 |
| fallback wiring | detection 1회 전달 (복제 없음) |
| tracker input | 2 near-dup dets 그대로 진입 |
| matched | 고 conf 1개가 claim |
| claimed | track 1 점유, claimed IoU≈0.85–0.98 |
| unmatched mint | 2nd det → `MULTI_DET_EXTRA` new ID |

**판정: E (복합 원인) = A (NMS output near-dup) + D (tracker unmatched mint 정책)**

대표 pair IoU: frame 124 = 0.76, frame 565 = 0.977.  
cam03_v1 multi_det 165프레임 전부 **near-dup(IoU≥0.7)** 이며 true two-person(IoU<0.35) **0**.

## 3. 지금까지의 수치 변화

| 단계 | analysis FPS | unexpected new/min | lost/min | true IOU | MULTI_DET_EXTRA | EXIT FP | 핵심 변경 |
|---|---:|---:|---:|---:|---:|---:|---|
| Legacy | 14.7 | 8.19 | 8.01 | (미측정/혼재) | (미측정) | 발생 | fps=15, pred 폭주 |
| Fix v2 | 14.7 | 4.55 | 4.20 | 10/150s live* | — | 0 | clamp, ultra-soft |
| FPS 교정 live | 29.x | 3.51 | 3.51 | 8/100s live* | — | 0 | fps=30, dt velocity, new 0.25 |
| Offline A (corrected) | n/a | 3.50 | 3.50 | **0** | **7** | — | fixed cache + label fix |
| Offline I | n/a | 3.00 | 3.00 | **0** | **6** | — | new 0.30 + prev bbox |
| **Offline M (hybrid_kp)** | n/a | **0.00** | **0.00** | **0** | **0** | — | I + near-dup suppress |

```text
Legacy→M unexpected new/min: ~100% 감소
A→M duplicate_frames: 135→0 (100%)
```

## 4. 실험 설계

- 고정 cache 재사용: `runs/tracking_ab/cam03_v1/detection_cache.jsonl` (YOLO 재실행 금지)
- A–J 전체 재실행 금지; **A/I 기준 재사용 + K/L/M만 신규**
- 도구: `scripts/replay_tracking_from_cache.py`
- 2인 안전성: synthetic P1/P2 200프레임 (`eval_two_person_synthetic_gt.py`)

## 5. 실험 결과

### 5.1 A / I / K / L / M

| config | new/min | lost/min | MULTI_DET_EXTRA | dup frames | unique pairs | retention | suppress | ghost max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 3.50 | 3.50 | 7 | 135 | 7 | 0.382 | 0 | 3.00s |
| I | 3.00 | 3.00 | 6 | 124 | 6 | 0.560 | 0 | 3.00s |
| K claimed_iou | 0 | 0 | 0 | 0 | 0 | 0.999 | 24 | 0 |
| L hybrid | 0 | 0 | 0 | 0 | 0 | 0.999 | 24 | 0 |
| **M hybrid_kp** | **0** | **0** | **0** | **0** | **0** | **0.999** | **24** | **0** |

start delay 233.6ms (≤0.5s). offline tracker-only FPS 수만 대.

### 5.2 Suppression 설계

| mode | 게이트 | multi-claimed 안전 |
|---|---|---|
| K | claimed IoU ≥ 0.70 | 없음 |
| L | IoU + center≤0.25 + area ratio | 2+ track pass → **거부** |
| **M** | L + keypoint dist (없으면 L) | 동일 거부 |

IoU 단독으로 임의 두 사람을 합치지 않음. claimed track / same-frame output box에만 적용. conf 내림차순 claim.

### 5.3 Synthetic 2인 GT (200f)

| config | hijack | wrong_suppress | merged | purity | coverage |
|---|---:|---:|---:|---:|---:|
| I | 0 | 0 | 0 | 1.0 | 0.983 |
| K/L/M | **0** | **0** | **0** | **1.0** | **1.0** |

## 6. 내가 한 판단

**문제→원인:** residual은 association threshold가 아니라 **NMS near-dup + mint**.

**판단:**

1. match_thresh 완화 기각.
2. claimed near-dup mint suppression 추가.
3. 수치 동등해도 **M** 선택 (다중 인물 안전).
4. production default **none** 유지; env로만 노출. live smoke 전 hold.

## 7. 최종 변경 사항

| 파일 | 변경 | 이유 |
|---|---|---|
| `tracking/simple_tracker.py` | near-dup suppress modes | MULTI_DET_EXTRA 억제 |
| `scripts/replay_tracking_from_cache.py` | K/L/M + metrics | 비교 |
| `scripts/eval_two_person_synthetic_gt.py` | synthetic P1/P2 GT | 오억제 검증 |
| `ai/postprocess/supervision_postprocessor.py` | `NEAR_DUP_SUPPRESS_MODE` env | 실험/운영 분리 |
| `tests/test_tracking_ab_replay.py` | suppress unit tests | 회귀 |

## 8. 최종 성과

- unexpected new/min **0**, lost/min **0**, MULTI_DET_EXTRA **0**
- retention **99.86%**, ghost **0s**, dup **0**
- synthetic 2인 hijack/wrong suppress **0**
- EXIT FP **0**, analysis FPS ~30 (live 기본값 미변경)
- tests **24 passed**

## 9. 한계

- cam03_v1에 실영상 2인 교차 없음 (multi_det=전부 near-dup)
- synthetic GT는 분리 보행 시나리오
- production default 미적용 / live smoke 미완
- detector NMS 자체 강화 미적용

## 10. 다음 작업

1. video_pool true two-person 100–300f 실영상 GT  
2. residual MULTI_DET_EXTRA / new-lost 1.x/min 원인 분해  
3. 장기 occlusion·복잡 CCTV 재평가  
4. appearance/ReID 필요성 판단  
5. Fall/Faint lifecycle 영향 측정  

## 운영 기본값 반영

### 적용 설정

- `NEAR_DUP_SUPPRESS_MODE=hybrid_kp`
- `SIMPLE_TRACK_NEW_TRACK_THRESH=0.30`
- 적용 범위: **전체 registered camera worker**
- 적용 방식: production default in `supervision_postprocessor` + `tracking_canary.production_tracking_defaults` + `start_ai_stable.sh` env
- canary per-camera override: **cleared / inactive** (도구는 유지)
- rollback: `NEAR_DUP_SUPPRESS_MODE=none`, `SIMPLE_TRACK_NEW_TRACK_THRESH=0.25` (`scripts/rollback_tracking_suppression.sh`)

### 적용 판단

문제: 동일 객체의 near-duplicate detection이 unmatched mint로 새 track이 되어 ID fragmentation·duplicate·ghost가 발생했다.

판단: 실제 2인 GT는 미완이지만 offline·live canary에서 기존 대비 핵심 수치가 개선되고 FPS 저하·주요 회귀가 없어 운영 기본값으로 반영했다. new/lost≤1 절대 목표 미달은 Known Limitation으로 관리한다.

근거 (cam_03 canary vs prior live baseline):

- new/min 4.25 → 1.75 (약 59%↓)
- lost/min 3.75 → 1.62 (약 57%↓)
- duplicate frames 239 → 75
- ghost max 1.3s → 0s
- retention 0.64 → 0.80
- analysis FPS ≈29 유지
- EXIT FP / worker crash 미관측

결과: **APPLIED WITH KNOWN LIMITATIONS** (전역 default 반영 후 smoke 수치를 하단에 기록)

### 남은 한계

- 실제 2인 교차 GT 미검증
- live new/lost ≤1/min 미달 가능
- MULTI_DET_EXTRA 일부 잔존
- 겹친 두 사람 wrong suppression 가능성 완전 배제 불가
- 장기 occlusion / 복잡 CCTV 미검증
- keypoint 부족 시 hybrid geometric fallback

### 포트폴리오용 요약

단일 인물 추적에서 Track ID가 반복 재발급되는 문제를 detection-cache 기반 offline replay로 분석했다. 처음에는 IoU association 실패를 의심했지만, 실제 원인은 Ultralytics NMS 이후 남은 near-duplicate detection이 unmatched 상태에서 신규 track으로 생성되는 구조였다. Claimed detection 기준 hybrid keypoint suppression을 적용해 offline에서 new/lost track과 duplicate를 0으로 줄였고, live canary에서도 new track 약 59%, lost track 약 57% 감소와 FPS 유지를 확인했다. 실제 2인 교차 GT 검증은 미완이지만 기존 대비 운영상 개선이 명확해 전역 기본값으로 반영했으며, 다중 객체 과억제 가능성은 후속 한계로 관리했다.

## Canary 배포 검증

### 적용 범위

- 대상: **cam_03 only**
- 방식: per-camera JSON flag (`runs/tracking_canary/canary_config.json`) + worker env inject
- global default: **NEAR_DUP_SUPPRESS_MODE=none unchanged**

### 배포 판단

문제: offline M 설정은 new/lost=0·retention≈99.9%였지만 실제 multi-object 회귀 위험이 남아 있었다.

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
