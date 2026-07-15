---
title: Tracking Association Offline A/B (cam_03 Detection Cache)
navTitle: "Tracking Offline A/B"
shortTitle: "Track A/B"
displayTitle: "Tracking Association Offline A/B"
category: Evidence
tags: [tracking, bytetrack, simple-tracker, offline-ab, iou, multi-det]
relatedDocs: [Tracking-Association-Stabilization, Bug-AI-Tracker-FrameRate-Mismatch, AI-Pipeline, Realtime-Camera-Runtime-Stabilization]
relatedFiles: [strange_ai/scripts/replay_tracking_from_cache.py, strange_ai/scripts/multi_person_proxy_from_cache.py, strange_ai/tracking/simple_tracker.py, strange_ai/ai/postprocess/supervision_postprocessor.py, strange_ai/ai/simulated_rtsp_publisher.py, strange_ai/tests/test_tracking_ab_replay.py]
updatedAt: 2026-07-13
project: smart-safety-ai
type: experiment-report
portfolio_use: true
order: 260
---

## 1. 문제 정의

대시보드 cam_03에서 Track ID가 반복 재발급되고(과거 44까지 상승), 동일 인물 fragmentation이 운영 목표를 초과했다.

이미 해결된 층:

- simulated RTSP `fps=15` 하드코딩 → **30 FPS 송출/분석**으로 교정
- analysis FPS ≈ 29.7 (목표 30의 90% 이상)
- MJPEG throttle은 **emit 후단** (`overlay_http.stream` sleep)
- EXIT outside-only 오표시 → **edge-trigger**로 FP 0

남은 핵심 문제 (교정 후 → K/L/M 억제로 offline 해소):

- offline cache에서 **true `IOU_BELOW_THRESHOLD` = 0**
- residual 원인 = **`MULTI_DET_EXTRA`** (NMS near-dup + tracker mint) → 레이어 판정 **E = A+D**
- **M_I_hybrid_kp_safe** offline: unexpected new/min **0**, MULTI_DET_EXTRA **0**, retention **0.999**
- production default는 **미변경** (env `NEAR_DUP_SUPPRESS_MODE`, live smoke 전 hold)

## 2. 기존 구조 (판단 기준)

```text
MP4 (~30 FPS, 3840x2160)
  -> ffmpeg publish (scale/pad 1280x720, fps=30)
  -> RTSP
  -> serve_ai_overlay reader (put_latest queue)
  -> YOLO pose imgsz=640 (Ultralytics xyxy/keypoints = source space)
  -> SimpleTrackAssigner (stability_fallback이 ByteTrack 결과 대체)
  -> MJPEG encode 1280x720 @ target 15 FPS (후단 throttle)
```

운영 tracker는 ByteTrack이 아니라 **`stability_fallback` → SimpleTrackAssigner**이다.

## 3. 실측 Baseline

### 3.1 Live (이전 라운드)

| 단계 | new/min | lost/min | analysis FPS |
|---|---:|---:|---:|
| Legacy (fps=15) | 8.19 | 8.01 | ~14.7 |
| Fix v2 | 4.55 | 4.20 | ~14.7 |
| 30 FPS + dt velocity + new_track_thresh=0.25 | 3.51 | 3.51 | ~29 |

### 3.2 Offline 고정 구간 대상

| 항목 | 값 |
|---|---|
| cameraLoginId | cam_03 |
| video | `/home/welabs/yolo_training/strange_ai_lstm/video_pool/cam2.mp4` |
| SHA256 | `d5c318316a09af1d57460879c06117f954afe8507fbcf87ec6a83e4b54b9ba3d` |
| native FPS | 30000/1001 ≈ 29.97 |
| native resolution | 3840x2160 |
| frame count | 9302 |
| duration | 310.38 s |
| experiment range | **frame 0–3599 (3600 frames, ≈120.1 s)** |
| detector cache | `runs/tracking_ab/cam03_v1/detection_cache.jsonl` |
| model | yolo26n-pose.pt, imgsz=640, conf=0.15, device=cuda |
| cache coordinate space | resize to **1280x720** then detect (publish path 정합) |
| multi_det frames | 165 / 3600 |

## 4. 실험 설계

### 4.1 도구

`scripts/replay_tracking_from_cache.py`

- production `SimpleTrackAssigner` import (복제 금지)
- cache 존재 시 detector 재실행 금지
- config별 `summary.json`, `switch_events.jsonl`, `frame_results.jsonl`
- 비교 산출물: `comparison_summary.csv`, `comparison_summary.md`

`scripts/multi_person_proxy_from_cache.py`

- multi-det 프레임 left-to-right P1/P2 pseudo identity
- `mean_track_purity`, `mean_track_coverage`, `hijack_proxy`

### 4.2 지표 정의

- **unexpected_new_tracks/min**: (total_new − expected_initial=1) / minutes  
- **lost_tracks/min**: lost transitions / minutes  
- **iou_below_threshold**: switch_reason=`IOU_BELOW_THRESHOLD` only (unmatched track existed but failed gates)  
- **multi_det_extra**: switch_reason=`MULTI_DET_EXTRA` (all active tracks already claimed this frame)  
- **id_retention_rate**: dominant track occupancy / person_present_frames (GT 없는 single-person proxy)  
- **duplicate_frames**: same-frame active boxes IoU≥0.7  
- **ghost_count**: missing_frames>1s 누적 (상대 비교용)  
- **track_start_delay_ms**: 첫 person det → 첫 track  
- **mean_track_purity / coverage**: multi-det pseudo P1/P2  

### 4.3 Labeling fix (skeptic)

| condition | switch_reason |
|---|---|
| no previous active tracks | `NEW_SCENE` |
| unmatched tracks exist but IoU/center fail | `IOU_BELOW_THRESHOLD` (+ previousTrackSnapshot, rejectedCandidates) |
| every track already claimed; extra det mints | `MULTI_DET_EXTRA` (+ claimed_track_diagnostics) |
| else | `NO_CANDIDATE` |

### 4.4 Config matrix

| config | 변경 요인 |
|---|---|
| A_current | new=0.25, match=0.20, ultra-soft on, predicted bbox |
| B_new_thresh_020 | new=0.20 |
| C_new_thresh_030 | new=0.30 |
| D_ultra_soft_off | ultra-soft off |
| E_ultra_soft_strict | ultra-soft stricter |
| F_match_thresh_015 | match=0.15 |
| G_prev_bbox_only | previous bbox only (no predict) |
| H_max_prev_pred_iou | max(prev, pred) IoU |
| I_new030_prev_bbox | **C+G 조합** |
| J_new030_match015_prev | C+G+F 조합 |

## 5. 결과와 판단

### 5.1 단일 인물 고정 구간 결과 (교정 후)

| config | unexpected new/min | lost/min | true IOU | ID retention | start delay ms | duplicate | selected |
|---|---:|---:|---:|---:|---:|---:|---|
| A_current | 3.4965 | 3.4965 | **0** | 0.3817 | 233.6 | 135 | |
| B 0.20 | 3.4965 | 3.4965 | 0 | 0.3817 | 0.0 | 145 | |
| **C 0.30** | **2.997** | **2.997** | **0** | **0.5358** | 233.6 | **124** | |
| D ultra off | 3.4965 | 3.4965 | 0 | 0.3817 | 233.6 | 135 | |
| E ultra strict | 3.4965 | 3.4965 | 0 | 0.3817 | 233.6 | 135 | |
| F match 0.15 | 3.4965 | 3.4965 | 0 | 0.3817 | 233.6 | 135 | |
| G prev only | 3.4965 | 3.4965 | 0 | **0.5575** | 233.6 | 135 | |
| H max iou | 3.4965 | 3.4965 | 0 | 0.5219 | 233.6 | 135 | |
| **I C+G** | **2.997** | **2.997** | **0** | **0.5595** | 233.6 | **124** | **Yes** |
| J C+G+F | 2.997 | 2.997 | 0 | 0.5595 | 233.6 | 124 | |

### 5.2 Multi-person proxy (165 multi-det frames)

| config | id_set_changes | mean purity | mean coverage | hijack_proxy |
|---|---:|---:|---:|---:|
| A_current | 39 | 0.6883 | 0.3576 | 0 |
| I_new030_prev_bbox | 35 | **0.7479** | **0.4394** | **0** |

### 5.3 Residual cause 분해 (A_current switch_events)

| 원인 | 횟수 | 비율 | 대표 frame |
|---|---:|---:|---:|
| MULTI_DET_EXTRA / COMPETING_TRACK_CLAIM | 7 | 87.5% | 124 (claimed IoU≈0.85), 565 (≈0.98) |
| NEW_SCENE | 1 | 12.5% | 123 |
| IOU_BELOW_THRESHOLD | 0 | 0% | — |

I residual: NEW_SCENE=1 + MULTI_DET_EXTRA=6.

**이전 오라벨:** offline 1차 리포트의 “IOU switch=7”은 multi-det mint를 IoU fail로 잘못 집계한 값이다. 교정 후 true IoU=0.

### 5.4 판단

1. **true unmatched association miss는 이 cache에서 0** → match_thresh 완화 실험이 무효과인 이유.  
2. **unexpected new residual = MULTI_DET_EXTRA** → near-duplicate YOLO box / single-claim policy가 다음 레버.  
3. **new_track_thresh=0.30 (C)** 이 unexpected new/lost를 줄이고 retention 개선.  
4. **previous bbox (G)** 가 retention을 추가로 개선 → I 선택.  
5. multi purity/coverage도 I가 A 대비 개선, hijack_proxy=0.  
6. 목표 `new/lost≤1.0`, `retention≥95%` 미달 → **production default 변경 금지**.

### 5.5 Baseline 대비 개선율

| 지표 | Legacy live | Offline A | Offline I | Legacy 대비 |
|---|---:|---:|---:|---:|
| unexpected new/min | 8.19 | 3.50 | 3.00 | **≈63% 감소** |
| true IOU switch / 2min | (혼재) | 0 | 0 | 라벨 교정 후 residual 아님 |
| multi purity | — | 0.688 | 0.748 | I 개선 |
| analysis FPS | 14.7 | 29+ live | n/a | FPS 해소 |

## 6. Near-dup 레이어 추적 + K/L/M

### 6.1 코드 레이어 판정

| 레이어 | frame 124/565 |
|---|---|
| Ultralytics/NMS | **중복 시작** (cache n_det=2, pair IoU 0.76 / 0.977) |
| person/pose postprocess | 중복 append 없음 |
| fallback wiring | 1회 전달 |
| tracker mint | claimed 후 2nd det → MULTI_DET_EXTRA |

**판정 E = A(NMS near-dup) + D(tracker mint 정책)**

### 6.2 A/I/K/L/M 수치 (동일 cache, A–J 전체 재실행 없음)

| config | new/min | lost/min | MULTI_DET_EXTRA | dup | retention | ghost max | suppress |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 3.50 | 3.50 | 7 | 135 | 0.382 | 3.00 | 0 |
| I | 3.00 | 3.00 | 6 | 124 | 0.560 | 3.00 | 0 |
| K claimed_iou | 0 | 0 | 0 | 0 | 0.999 | 0 | 24 |
| L hybrid | 0 | 0 | 0 | 0 | 0.999 | 0 | 24 |
| **M hybrid_kp** | **0** | **0** | **0** | **0** | **0.999** | **0** | **24** |

### 6.3 Synthetic 2인 GT (200f)

K/L/M: hijack=0, wrong_suppress=0, purity=1.0, coverage=1.0, MULTI_DET_EXTRA=0  
I: MULTI_DET_EXTRA=1, dup frames=20 (near-dup mint)

## 7. 최종 선택

- **실험 최선**: `M_I_hybrid_kp_safe`  
  - I 기반 (new=0.30, prev bbox)  
  - near_dup_suppress_mode=`hybrid_kp`  
  - conf sort + multi-claimed refuse  
- **K/L과 수치 동일**이나 multi-object 안전 정책상 M 채택  
- **production default**: **미변경** (env only)  
  - `NEAR_DUP_SUPPRESS_MODE=hybrid_kp`  
  - `SIMPLE_TRACK_NEW_TRACK_THRESH=0.30`  
  - live cam_03 smoke 후 default 전환 검토  

## 8. 최종 변경 사항

| 파일 | 변경 | 이유 |
|---|---|---|
| `tracking/simple_tracker.py` | near-dup suppress + conf sort | MULTI_DET_EXTRA 제거 |
| `scripts/replay_tracking_from_cache.py` | K/L/M + metrics | 비교 |
| `scripts/eval_two_person_synthetic_gt.py` | synthetic P1/P2 GT | 오억제 검증 |
| `ai/postprocess/supervision_postprocessor.py` | env gate (default none) | 실험/운영 분리 |
| `tests/test_tracking_ab_replay.py` | suppress unit tests | 회귀 |

## 9. 성과 / 한계

성과: offline 목표 new/lost≤1, MULTI_DET_EXTRA≤1, dup 80%↓, retention≥95%, ghost≤1s **달성**.  
한계: 실영상 2인 교차 GT 미완; live canary PARTIAL (new/min 1.75, lost/min 1.62).

## Canary → 운영 기본값 (요약)

- canary(cam_03): hybrid_kp + new 0.30 → live new/min 4.25→1.75, lost 3.75→1.62, FPS≈29, ghost 0
- 이후 **전역 production default**로 동일 설정 반영 (`APPLIED WITH KNOWN LIMITATIONS`)
- per-camera canary override 비활성, rollback 스크립트 유지 (`scripts/rollback_tracking_suppression.sh`)
- Known Limitations: 실 2인 GT 미완, live new/lost≤1 미달 가능, residual MULTI_DET
- 상세: `Tracking-Association-Stabilization.md` 운영 기본값 반영 섹션

## 10. 산출물 경로

GPU:

- `runs/tracking_ab/cam03_v1/detection_cache.jsonl` (기존)
- `runs/tracking_ab/cam03_v1_klm/comparison_summary.csv`
- `runs/tracking_ab/two_person_synthetic_gt/`
- `runs/tracking_canary/cam_03/<timestamp>/`

Local wiki:

- `docs/wiki/content/Tracking-Association-Offline-AB-2026-07-13.md`
- `docs/wiki/content/Tracking-Association-Stabilization.md`
