---
title: "YOLO Pose 6종 비교와 YOLO26n 선택 근거"
navTitle: "YOLO26n 비교 실험"
shortTitle: "모델 비교"
category: Experiments
relatedDocs: [ADR-003-YOLO26n-Selection, Benchmark-History, LSTM-Experiment-Results]
relatedFiles: [docs/wiki/data/modelMetrics.json, .tmp/gpu_benchmark/lstm_extractor_comparison_fast/summary.csv]
updatedAt: 2026-07-15
type: experiment
status: verified
verifiedAt: 2026-07-15
evidenceLevel: offline-benchmark
canonicalFor: yolo26n-pose
---

## 1. 문제 정의

실시간 CCTV 관제 시스템에서 쓰러짐/실신(Faint) 이벤트를 감지하기 위해서는 영상 프레임으로부터 사람의 관절 좌표(Keypoint Sequence)를 빠르고 정확하게 추출해야 합니다.
가장 빠르고 가벼운 YOLO Pose 모델이 다운스트림(Downstream) 행동 분류기인 LSTM 모델에서 항상 최선의 Faint 탐지 성능(Recall)으로 연결되지는 않는 불일치 문제가 발생했습니다.

안전 관제 특성상 오탐(False Positive)보다 사고를 놓치는 미탐(False Negative)의 치명성이 매우 높으므로, 단순 Accuracy 보다는 **Faint Recall**과 **F1-Score**를 최우선 지표로 삼아 최적의 Pose Extractor 모델을 선정해야 합니다.

## 2. 실제 관찰 및 원인

초기 테스트 결과 YOLOv8n-pose 등 가볍고 빠른 모델들이 개별 관절 검출률은 우수하였으나, 다운스트림 LSTM에 입력되는 관절 시퀀스의 시간적 일관성(Temporal Consistency)이 떨어져 결과적으로 미탐을 다량 유발하였습니다.
YOLOv11n-pose와 YOLO26n-pose를 동일 조건에서 상세 비교한 결과, YOLOv11n-pose가 관절 결손율(Missing Rate)과 실행 시간에서는 우수하였으나 실제 사람 검출 능력 및 생성 시퀀스 연속성 측면에서 YOLO26n-pose가 월등히 안정적임을 확인하였습니다.

## 3. 내가 한 판단

1. **YOLO26n-pose 최종 선정**: 프레임당 추론 지연 시간이 약간 늘어나더라도 Faint Recall 방어율 및 다운스트림 LSTM의 최종 판단 정확도를 극대화할 수 있는 `YOLO26n-pose`를 최적의 기본 모델로 선정하였습니다.
2. **평가 지표의 다차원화**: 단순 Pose Extractor 단독 지표(mAP, Latency)에 의존하지 않고, 최종 LSTM 연계 성능(Faint Recall, F1, Random Seed 안정성)을 종합 지표로 수립하여 평가하였습니다.
3. **선택형 런타임 백엔드**: 라이브러리 충돌 및 GPU VRAM 부족을 대비하여 `PyTorch Fallback`을 안정적으로 유지하고 선택적으로 `TensorRT`를 구동할 수 있도록 설계하였습니다.

## 4. 구현 및 검증

현재 develop 코드(`detector/yolo_pose_detector.py` 및 `ai/inference/tensorrt_runtime.py`)에서 `yolo26n-pose.pt` 가 기본 모델로 탑재되어 구동 중이며, 추론 결과는 `(1, 30, 54)` 규격의 텐서로 다운스트림 LSTM에 안정적으로 주입됩니다.

### 4.1 YOLO Pose 기본 성능 비교
동일 RTSP 스트림 조건에서 각 Pose Extractor 모델의 단독 성능을 비교한 결과입니다.

| 모델 | 평균 FPS | 평균 지연 | GPU Memory | Keypoint Missing Rate |
| :--- | :---: | :---: | :---: | :---: |
| YOLOv8n-pose | 131.70 | 4.65ms | 33.33MB | 0.1122 |
| YOLOv11n-pose | 121.70 | 5.31ms | 77.32MB | 0.1166 |
| **YOLO26n-pose (선정)** | 118.15 | 5.62ms | 90.07MB | 0.1275 |

### 4.2 Sequence 생성 능력 비교 (v11n vs 26n)
60개 평가용 비디오 클립에 대한 LSTM 시퀀스 확보력 실측 결과입니다.

| 지표 | YOLOv11n-pose | YOLO26n-pose | 차이 |
| :--- | :---: | :---: | :---: |
| 처리 영상 수 | 60 | 60 | 동일 |
| Person Detection 수 | 2,690 | 3,084 | +394 (약 +14.6%) |
| 생성 시퀀스 수 | 131 | 139 | +8 (약 +6.1%) |
| Zero Sequence Clip 수 | 15 | 9 | 6개 감소 (40% 감소) |
| Missing Rate | 0.079984 | 0.130237 | YOLOv11n 우세 |
| Runtime | 34.0531초 | 36.8406초 | 약 8.2% 증가 |

> [!NOTE]
> YOLO26n-pose는 missing rate가 다소 높지만, 더 많은 사람을 검출하여 LSTM 판단에 필수적인 키포인트 시퀀스를 지속적으로 공급하며, 시퀀스가 아예 끊기는 Zero Sequence Clip을 40% 방지합니다.

### 4.3 최종 LSTM Faint 분류 성능 비교
두 Extractor가 추출한 시퀀스를 기반으로 동일 LSTM 모델을 학습/평가한 최종 결과입니다.

| 지표 | YOLOv11n-pose | YOLO26n-pose | 변화 |
| :--- | :---: | :---: | :---: |
| Accuracy | 0.618321 | 0.604317 | -1.40%p |
| Precision | 0.500000 | 0.520408 | +2.04%p |
| **Faint Recall** | 0.660000 | **0.864407** | **+20.44%p** (상대 +31.0%) |
| **F1-Score** | 0.568966 | **0.649682** | **+8.07%p** (상대 +14.2%) |

### 4.4 Random Seed 반복 안정성 비교 (Seed 42, 43, 44 반복)
초기 가중치 편차에 휘둘리지 않는지 무작위 시드 반복 평가 결과입니다.

| 지표 | YOLOv11n-pose | YOLO26n-pose | 변화 |
| :--- | :---: | :---: | :---: |
| Faint Recall 평균 | 0.486667 | **0.813559** | 상대 +67.2% |
| Faint Recall 표준편차 | 0.167597 | **0.123003** | 편차 감소 |
| F1-Score 평균 | 0.500827 | **0.634582** | 상대 +26.7% |
| **F1-Score 표준편차** | 0.080314 | **0.022213** | **72.3% 감소** |

YOLO26n-pose는 가중치 초기화 시드가 달라져도 F1 표준편차가 약 72.3% 감소하여 운영상 뛰어난 견고함을 입증하였습니다.

---

## 5. 변경 전 실험 기록 (2026-06-26 이전)

아래 표는 초기 소규모 테스트 셋에서 수행되었던 구형 비교 결과입니다.

| Rank | Model | Faint Recall | F1-Score | Precision | Accuracy | FP | FN | Missing Rate | Eval Sequences | Runtime(s) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | yolo26n-pose | 0.750877 | 0.612303 | 0.516908 | 0.600000 | 400 | 142 | 0.128261 | 1355 | 361.6531 |
| 2 | yolo26s-pose | 0.663087 | 0.606507 | 0.558824 | 0.597109 | 390 | 251 | 0.126229 | 1591 | 369.6238 |
| 3 | yolo11n-pose | 0.657293 | 0.634436 | 0.613115 | 0.672741 | 236 | 195 | 0.090368 | 1317 | 345.3193 |
| 4 | yolo11s-pose | 0.583181 | 0.583181 | 0.583181 | 0.644583 | 228 | 228 | 0.116475 | 1283 | 379.9346 |
| 5 | yolov8n-pose | 0.525620 | 0.576087 | 0.637275 | 0.660377 | 181 | 287 | 0.092656 | 1378 | 329.1220 |
| 6 | yolov8s-pose | 0.280057 | 0.401216 | 0.707143 | 0.614984 | 82 | 509 | 0.119393 | 1535 | 336.5217 |

---

## 6. 한계 및 후속 작업

### 한계
- YOLO26n-pose는 Faint 감지에 극도로 민감하도록 설계되어 오탐(False Positive)의 개수가 타 모델 대비 높습니다.
- 단일 프레임 수준의 관절 mAP 성능 최적화와 다운스트림 오탐 제어가 결합되어야 합니다.

### 후속 작업
- **Hard-Negative 재학습**: 현장에서 오탐으로 식별된 Normal 동작 데이터를 LSTM 및 YOLO 학습 풀에 추가하는 Self-Improving 파이프라인을 구축해야 합니다 (현재 미완료).
- **consecutive-Faint 판정 조율**: 후처리 단에서 연속 검출 기준 프레임을 높여 오경보 비율을 개선하는 실험이 필요합니다.

---
#model-comparison #benchmark #yolo #faint-recall #evidence
