---
title: Benchmark History
category: Experiments
tags: [benchmark-history, evidence, searched-paths, yolo]
relatedDocs: [Model-Comparison, Model-Decision-YOLO26n, LSTM-Experiment-Results]
relatedFiles: [.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv, benchmark/results/model_benchmark.csv, pose_model_summary.csv]
updatedAt: 2026-06-26
---

# Benchmark History

## 목적

모델 선택 문서에 사용한 benchmark/result 파일의 출처, 사용 여부, 제외 사유를 기록한다.

## 배경

모델 성능 숫자는 문서 안의 기억이 아니라 결과 파일에서 가져와야 한다. 특히 YOLO pose 모델 선택은 pose-only FPS와 downstream LSTM 성능이 섞이기 쉬우므로 파일별 신뢰도를 분리한다.

## 핵심 내용

| File | Evidence | Models | Used | Reason |
| --- | --- | --- | --- | --- |
| `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv` | local copy from GPU PC, original remote path under `/home/welabs/yolo_training` | yolo26s, yolo26n, yolo11s, yolo11n, yolov8s, yolov8n | Yes | six-model downstream LSTM comparison. `metrics_status=OK` |
| `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/<model>/summary.json` | local copy from GPU PC | same six models | Yes | confusion matrix, FP/FN, threshold audit 확인 |
| `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/<model>/eval_predictions.csv` | local copy from GPU PC | same six models | Reference | row-level prediction 검증용. 이번 문서에는 집계값만 사용 |
| `pose_model_summary.csv` | local file | same six models | Auxiliary | FPS와 inference latency만 포함. downstream Faint metric 없음 |
| `strange_ai/pose_model_summary.csv` | duplicate local file | same six models | Reference | root `pose_model_summary.csv`와 같은 계열의 pose-only summary |
| `benchmark/results/model_benchmark.csv` | local file | same six models | No | 모든 row가 `SKIPPED: sample_videos folder is empty...` 상태 |
| `benchmark/results/model_benchmark.md` | local file | same six models | No | CSV와 동일하게 성공 row 없음 |
| `benchmark/results/lstm_sequence_length_8_16_30/summary.csv` | local file | YOLO26n only | No | `missing_metadata` 상태라 성능값으로 사용 불가 |
| `benchmark/results/lstm_sequence_length_8_16_30/*/raw_result.json` | local file | YOLO26n only | No | metadata 누락으로 dry-run 실패 기록 |

## 입력

검색 키워드는 `benchmark`, `result`, `eval`, `evaluation`, `metrics`, `summary`, `model_comparison`, `pose`, `yolo`, `faint`, `recall`, `f1`, `precision` 계열이다.

## 출력

- authoritative result: `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- per-model detail: `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/<model>/summary.json`
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

- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv`
- `.tmp/gpu_benchmark/lstm_extractor_comparison_fast/<model>/summary.json`
- `pose_model_summary.csv`
- `benchmark/results/model_benchmark.csv`
- `benchmark/results/lstm_sequence_length_8_16_30/summary.csv`

## 관련 문서

- [Model-Comparison](Model-Comparison.md)
- [Model-Decision-YOLO26n](Model-Decision-YOLO26n.md)
- [LSTM-Experiment-Results](LSTM-Experiment-Results.md)

## 주의사항

`pose_model_summary.csv`의 FPS가 좋아도 downstream LSTM Faint Recall이 낮으면 관제 이벤트 판단 모델로는 우선순위가 내려간다. 이번 선택의 authoritative 기준은 GPU LSTM comparison 결과다.

## 후속 작업

- `.tmp`에 받은 원본을 장기 보존할지, 별도 `docs/wiki/evidence` 또는 외부 artifact 저장소에 복사할지 결정한다.
- 다음 benchmark부터는 commit 대상 문서와 raw artifact 보관 위치를 분리하고, 문서에는 raw file hash를 기록한다.
