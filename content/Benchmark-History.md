---
title: Benchmark History
category: Experiments
tags: [benchmark-history, evidence, searched-paths, yolo, gpu-benchmark]
relatedDocs: [Model-Comparison, Model-Decision-YOLO26n, LSTM-Experiment-Results]
relatedFiles: [gpu_results_import/PROJECT_SUMMARY.md, gpu_results_import/lstm_eval_digest.txt, gpu_results_import/benchmark/results/lstm_sequence_length_8_16_30_full_v2/summary.csv]
updatedAt: 2026-06-26
---

# Benchmark History

## 목적

모델 선택 및 성능 비교 문서에 사용한 benchmark/result 파일의 출처, 사용 여부, 제외 사유를 기록한다.

## 배경

모델 성능 숫자는 문서 안의 기억이 아니라 결과 파일에서 가져와야 한다. 특히 YOLO pose 모델 선택은 pose-only FPS와 downstream LSTM 성능이 섞이기 쉬우므로 파일별 신뢰도를 분리한다.

## 핵심 내용

| File | Evidence | Models | Used | Reason |
| --- | --- | --- | --- | --- |
| `gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json` | 최종 대규모 Stratified Split 평가 결과 | yolo26n | **Yes (Authoritative)** | 최종 대규모 데이터셋(Normal 1,392 / Faint 1,392) 기반 최종 평가 및 threshold 감사 결과로 사용 |
| `gpu_results_import/benchmark/results/lstm_sequence_length_8_16_30_full_v2/summary.csv` | 8/16/30 sequence length full_v2 결과 | yolo26n (8, 16, 30) | **Yes** | 14만 시퀀스 대규모 sequence length 비교 지표로 활용. (8 프레임은 OOM 실패) |
| `gpu_results_import/sequence_length_smoke.log` | 8/16/30 sequence length smoke 결과 | yolo26n (8, 16, 30) | **Yes** | 소규모 연동용 smoke 테스트 지표 기록으로 사용 |
| `gpu_results_import/benchmark/results/lstm_sequence30_motion_features/summary.json` | 51D Baseline 기준 평가 결과 | yolo26n, yolo11n, yolov8s | **Yes** | 모션 피처 추가를 위한 51D Baseline (17 x 3) 1차 기준 지표로 사용 |
| `gpu_results_import/benchmark/lstm_sequence30_error_analysis.md` | 클래스 불균형 완화 실험 분석 로그 | yolo26n | **Yes** | CE vs Weighted CE vs Oversample 기법 성능 비교 근거로 사용 |
| `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv` | GPU PC에서 수행한 6개 모델 fast 비교 결과 | yolo26s, yolo26n, yolo11s, yolo11n, yolov8s, yolov8n | Yes | six-model downstream LSTM comparison. `metrics_status=OK` |
| `pose_model_summary.csv` 및 `gpu_results_import/pose_model_summary.csv` | local & dump 파일 | same six models | Auxiliary | FPS와 inference latency만 포함. downstream Faint metric 없음 |
| `benchmark/results/model_benchmark.csv` | local file | same six models | No | 모든 row가 `SKIPPED: sample_videos folder is empty...` 상태 |
| `benchmark/results/lstm_sequence_length_8_16_30/summary.csv` | local file | YOLO26n only | No | `missing_metadata` 상태라 성능값으로 사용 불가 |
| `strange_ai/ai/action/motion_features.py` | local code | feature extraction | Yes | 51D keypoint feature에 `center_drop`, `velocity`, `torso_angle` 3개를 붙여 54D를 만드는 구조 확인 |
| `strange_ai/benchmark/compare_lstm_extractors.py` | local code | LSTM benchmark | Yes | `sequence_to_features`에서 motion feature를 붙이고 benchmark output을 생성하는 경로 확인 |

## 입력

검색 키워드는 `benchmark`, `result`, `eval`, `evaluation`, `metrics`, `summary`, `model_comparison`, `pose`, `yolo`, `faint`, `recall`, `f1`, `precision` 계열이다.

## 출력

- Authoritative 최종 split 결과: `gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json`
- Sequence Length 비교 결과: `gpu_results_import/benchmark/results/lstm_sequence_length_8_16_30_full_v2/summary.csv`
- 제외 파일과 사유 목록

## 동작 흐름

```text
PowerShell local file search
-> inspect user-downloaded GPU benchmark files
-> classify pose-only vs downstream LSTM metrics
-> reject skipped or missing_metadata results
-> record selected evidence in Wiki docs
```

## 관련 파일

- `gpu_results_import/benchmark/results/lstm_yolo26n_final_split_test_audit/YOLO26n-pose/summary.json`
- `gpu_results_import/benchmark/results/lstm_sequence_length_8_16_30_full_v2/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `pose_model_summary.csv`
- `strange_ai/ai/action/motion_features.py`
- `strange_ai/benchmark/compare_lstm_extractors.py`

## 관련 문서

- [Model-Comparison](Model-Comparison.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)
- [LSTM-Experiment-Results](LSTM-Experiment-Results.md)
- [LSTM-Sequence-Length-Comparison](LSTM-Sequence-Length-Comparison.md)
- [Feature-Vector-51D-vs-54D](Feature-Vector-51D-vs-54D.md)

## 주의사항

`pose_model_summary.csv`의 FPS가 좋아도 downstream LSTM Faint Recall이 낮으면 관제 이벤트 판단 모델로는 우선순위가 내려간다. 이번 선택의 authoritative 기준은 GPU LSTM comparison 결과 및 최종 Split Test Audit 지표이다.

## 후속 작업

- 로컬 `gpu_results_import` 내에 복사된 신규 지표 파일들이 훼손되거나 유실되지 않도록 git 버전 관리에 백업 여부를 검증한다.
- 차기 54D 모션 피처 학습 결과 획득 시 신규 파일 경로를 이 이력 테이블에 추가 등록한다.
