---

title: 실시간 Faint 탐지 모델 실험 및 추론 파이프라인 고도화
category: Experiments
tags:

* YOLO-Pose
* LSTM
* TensorRT
* ByteTrack
* RTSP
* Hard-Negative
* Self-Improving-AI
  updatedAt: 2026-07-14
  source: Google Drive - 모델 실험

---

# 실시간 Faint 탐지 모델 실험 및 추론 파이프라인 고도화

## 1. 문서 개요

스마트 안전 관제 시스템의 실시간 Faint 탐지 성능을 높이기 위해 다음 영역을 단계적으로 실험하였다.

* YOLO Pose 모델별 속도 및 키포인트 품질 비교
* YOLO Pose 결과가 LSTM 분류 성능에 미치는 영향 검증
* Threshold 및 Random Seed 안정성 평가
* 51차원에서 54차원으로의 입력 특징 확장
* RTSP 4채널 실시간 처리 성능 검증
* ByteTrack 및 Bounding Box 안정화
* TensorRT 적용에 따른 추론 지연 개선
* Hard Negative 및 오류 수집 파이프라인 구축
* 영상과 AI Overlay 간 프레임 동기화 구조 보강

> **주의:** 이 문서에는 서로 다른 데이터셋과 평가 조건으로 수행된 실험이 포함되어 있다. 따라서 초기 소규모 모델 선정 실험, 54차원 특징 실험, 후기 대규모 평가 결과를 서로 직접 비교해서는 안 된다.

---

# 2. STAR 요약

## Situation

RTSP CCTV 영상에서 사람의 실신 또는 쓰러짐을 실시간으로 탐지해야 했지만 다음 문제가 존재하였다.

1. 가장 빠른 YOLO Pose 모델이 반드시 가장 좋은 Faint 탐지 성능으로 이어지지는 않았다.
2. 정적인 키포인트 좌표만으로는 앉기·눕기·허리 굽히기와 실제 쓰러짐을 구분하기 어려웠다.
3. 학습과 실시간 추론 코드에서 LSTM 시퀀스 길이와 입력 차원이 서로 달랐다.
4. 4개 카메라를 동시에 처리할 때 영상 멈춤과 높은 CPU 사용률이 발생했다.
5. TensorRT가 YOLO 추론을 빠르게 하더라도 전체 스트리밍 처리량이 개선되는지는 검증되지 않았다.
6. 오탐과 미탐을 재학습 데이터로 활용하기 위한 검증 가능한 오류 수집 구조가 필요했다.
7. 영상과 AI Metadata가 서로 다른 경로로 전달되어 Bounding Box가 실제 영상 프레임과 어긋날 가능성이 있었다.

안전 관제 시스템에서는 실신 상황을 놓치는 비용이 오탐보다 크다고 판단하여, 단순 Accuracy보다 **Faint Recall을 우선 지표**로 설정하였다.

## Task

다음 목표를 기준으로 모델과 파이프라인을 개선하였다.

* Faint Recall과 F1이 높은 Pose Extractor 선정
* Seed 및 Threshold 변화에도 안정적인 모델 확보
* 4개 RTSP 채널에서 카메라별 약 30 FPS 처리
* 정적 자세와 쓰러지는 동작을 구분할 수 있는 특징 설계
* YOLO 추론 지연 감소와 실제 End-to-End 개선 여부 분리 측정
* Hard Negative와 False Negative를 안전하게 재학습 후보로 수집
* AI가 실제 분석한 프레임을 기준으로 Evidence Chain 구성

## Action

1. YOLOv8n-pose, YOLOv11n-pose, YOLO26n-pose의 속도·지연·메모리·키포인트 결손률을 비교하였다.
2. 최종 후보를 YOLOv11n-pose와 YOLO26n-pose로 좁히고 동일한 Normal/Faint 데이터에서 LSTM을 학습하였다.
3. 생성된 시퀀스 수, 시퀀스가 생성되지 않은 영상 수, Faint Recall, F1을 함께 평가하였다.
4. Threshold 0.3~0.7 구간과 Seed 42·43·44를 반복 평가하였다.
5. 기존 51차원 키포인트에 Motion 또는 Bounding Box 기반 특징을 추가한 54차원 입력을 실험하였다.
6. RTSP 4채널에서 총 12,000프레임을 처리하며 YOLO·LSTM 지연과 FPS를 측정하였다.
7. Tracker Buffer, IoU 재연결, EMA Bounding Box Smoothing을 적용하였다.
8. PyTorch와 TensorRT를 단일 영상과 실제 RTSP 환경에서 각각 비교하였다.
9. FP를 Hard Negative, FN을 Reinforcement Candidate, 검증 실패 데이터를 Quarantine으로 분리하였다.
10. `frameId`, `capturedAtMs`, `processedAtMs`, `publishedAtMs`, `evidenceId`를 Payload에 추가하였다.

## Result

* YOLO26n-pose의 Faint Recall이 **0.6600에서 0.8644로 20.44%p 증가**
* F1이 **0.5690에서 0.6497로 8.07%p 증가**
* 반복 Seed 기준 F1 표준편차가 **0.0803에서 0.0222로 72.3% 감소**
* 후기 54차원 평가에서 Accuracy **93.45%**, F1 **93.49%** 기록
* 54차원 모델의 FP와 FN이 각각 약 **38.6%, 38.9% 감소**
* RTSP 4채널 평균 **29.70 FPS**
* 평균 YOLO 지연 **6.34ms**, 평균 LSTM 지연 **0.41ms**
* TensorRT 적용 시 단일 영상 평균 YOLO 지연 **45.33% 감소**
* 실제 RTSP에서도 YOLO 지연 **40.81% 감소**
* 다만 RTSP End-to-End FPS는 거의 동일하여 병목이 GPU가 아닌 영상 송출·인코딩·렌더링 구간에 있음을 확인
* 최종 Pose Extractor로 **YOLO26n-pose 선정**
* TensorRT는 **PyTorch Fallback을 유지하는 선택형 Backend**로 판단

---

# 3. 실험 1: YOLO Pose 기본 성능 비교

## Situation

Pose Extractor의 속도와 키포인트 품질이 실시간 처리와 LSTM 입력 품질에 영향을 주므로 모델별 기본 성능 비교가 필요했다.

## Action

동일 RTSP 조건에서 YOLOv8n-pose, YOLOv11n-pose, YOLO26n-pose를 비교하였다.

## Result

| 모델            | 평균 FPS |  평균 지연 | GPU Memory | Keypoint Missing Rate |
| ------------- | -----: | -----: | ---------: | --------------------: |
| YOLOv8n-pose  | 131.70 | 4.65ms |    33.33MB |                0.1122 |
| YOLOv11n-pose | 121.70 | 5.31ms |    77.32MB |                0.1166 |
| YOLO26n-pose  | 118.15 | 5.62ms |    90.07MB |                0.1275 |

YOLOv8n-pose가 가장 빠르고 가벼웠다. 그러나 Pose 단계의 속도만으로 최종 모델을 선택하지 않고, 각 모델이 생성한 키포인트가 LSTM Faint 분류 성능으로 어떻게 이어지는지를 추가로 평가하였다.

---

# 4. 실험 2: Sequence 생성 능력 비교

## Situation

LSTM은 일정 길이 이상의 키포인트가 쌓여야 예측할 수 있다. 따라서 키포인트 결손률뿐 아니라 실제로 생성 가능한 시퀀스 수와 시퀀스가 하나도 생성되지 않는 영상 수도 중요했다.

## Task

YOLOv11n-pose와 YOLO26n-pose가 LSTM 입력 시퀀스를 얼마나 안정적으로 만드는지 비교하였다.

## Action

모델별로 60개 영상을 처리하여 사람 검출 수, 생성 시퀀스 수, Zero Sequence Clip 수를 측정하였다.

## Result

| 지표                  | YOLOv11n-pose | YOLO26n-pose |            차이 |
| ------------------- | ------------: | -----------: | ------------: |
| 처리 영상               |            60 |           60 |            동일 |
| Person Detection    |         2,690 |        3,084 | +394, 약 14.6% |
| Keypoint Extraction |         2,690 |        3,084 |          +394 |
| 생성 시퀀스              |           131 |          139 |    +8, 약 6.1% |
| Zero Sequence Clip  |            15 |            9 | 6개 감소, 40% 감소 |
| Missing Rate        |      0.079984 |     0.130237 |   YOLOv11n 우세 |
| Runtime             |      34.0531초 |     36.8406초 |     약 8.2% 증가 |

YOLOv11n-pose가 키포인트 결손률과 실행 시간에서는 우수했다. 반면 YOLO26n-pose는 더 많은 사람과 키포인트를 검출하여 LSTM 시퀀스를 더 많이 확보했고, 시퀀스가 전혀 생성되지 않는 영상을 40% 줄였다.

---

# 5. 실험 3: YOLO Pose별 LSTM Faint 분류 성능

## Situation

Pose Extractor의 최종 가치는 단순 키포인트 품질보다 실제 Faint 분류 성능으로 판단해야 했다.

## Action

Normal과 Faint를 균형 있게 샘플링하고, 두 Pose Extractor가 생성한 시퀀스로 각각 LSTM을 학습·평가하였다.

초기 비교 데이터 구성은 다음과 같다.

| Split      | Normal | Faint | 합계 |
| ---------- | -----: | ----: | -: |
| Train      |     30 |    30 | 60 |
| Validation |     30 |    30 | 60 |
| Test       |     30 |    30 | 60 |

## Result

| 지표           | YOLOv11n-pose | YOLO26n-pose |           변화 |
| ------------ | ------------: | -----------: | -----------: |
| Accuracy     |      0.618321 |     0.604317 |      -1.40%p |
| Precision    |      0.500000 |     0.520408 |      +2.04%p |
| Faint Recall |      0.660000 | **0.864407** | **+20.44%p** |
| F1           |      0.568966 | **0.649682** |  **+8.07%p** |

YOLO26n-pose는 Accuracy가 약간 낮았지만, 안전 관제에서 가장 중요한 Faint Recall이 약 66.0%에서 86.4%로 증가했다. 상대적으로는 약 31.0% 개선되었다.

F1도 약 14.2% 상대 개선을 보여, Recall 증가가 단순한 한쪽 클래스 편향으로만 발생한 것은 아니라고 판단하였다.

다만 예측 분포는 다음과 같았다.

| 모델            | Predicted Normal | Predicted Faint |
| ------------- | ---------------: | --------------: |
| YOLOv11n-pose |               65 |              66 |
| YOLO26n-pose  |               41 |              98 |

YOLO26n-pose는 Faint에 더 민감했다. 이는 미탐 감소에는 유리하지만 Normal을 Faint로 판단하는 오탐 위험이 있으므로 후처리 조건이 필요했다.

---

# 6. 실험 4: Threshold Sweep

## Situation

Faint 판단 Threshold가 높으면 미탐이 증가하고, 낮으면 오탐이 증가한다. 모델별 Threshold 민감도를 확인할 필요가 있었다.

## Action

Threshold를 0.3부터 0.7까지 변경하였다.

## YOLOv11n-pose 결과

| Threshold | Recall | Precision |         F1 |
| --------: | -----: | --------: | ---------: |
|       0.3 | 1.0000 |    0.3817 |     0.5525 |
|       0.4 | 0.9400 |    0.4352 | **0.5949** |
|       0.5 | 0.6600 |    0.5000 |     0.5690 |
|       0.6 | 0.4200 |    0.5526 |     0.4773 |
|       0.7 | 0.1800 |    0.6000 |     0.2769 |

YOLOv11n-pose는 Threshold 변경에 따라 Recall과 F1이 크게 변했다.

## YOLO26n-pose 결과

| Threshold |     Recall |  Precision |         F1 |
| --------: | ---------: | ---------: | ---------: |
|       0.3 | **0.9492** |     0.5000 | **0.6550** |
|       0.4 |     0.8983 |     0.5096 |     0.6503 |
|       0.5 |     0.8644 | **0.5204** |     0.6497 |
|       0.6 |     0.6610 |     0.4756 |     0.5532 |
|       0.7 |     0.4068 |     0.4615 |     0.4324 |

YOLO26n-pose는 Threshold 0.3~0.5 구간에서 F1이 약 0.65로 유지되었다. 특정 Threshold에 과도하게 의존하지 않는다는 점에서 운영 안정성이 더 높았다.

초기 실험에서는 0.3이 가장 높은 Recall과 F1을 기록했으나, 실제 운영 Threshold는 오탐 비용과 연속 프레임 조건을 함께 고려하여 결정해야 한다.

---

# 7. 실험 5: Random Seed 반복 안정성

## Situation

한 번의 학습 결과만으로 모델을 선택하면 초기 가중치와 데이터 순서에 따른 우연한 결과일 수 있었다.

## Action

Seed 42, 43, 44에서 동일 실험을 반복하였다.

## Result

| 지표                | YOLOv11n-pose | YOLO26n-pose |
| ----------------- | ------------: | -----------: |
| Faint Recall 평균   |      0.486667 | **0.813559** |
| Faint Recall 표준편차 |      0.167597 | **0.123003** |
| F1 평균             |      0.500827 | **0.634582** |
| F1 표준편차           |      0.080314 | **0.022213** |

YOLO26n-pose의 평균 Faint Recall은 상대적으로 약 67.2%, 평균 F1은 약 26.7% 높았다.

특히 F1 표준편차가 0.080314에서 0.022213으로 약 **72.3% 감소**하여 Seed가 달라져도 더 안정적인 결과를 보였다.

### 최종 판단

최종 Pose Extractor는 다음 이유로 **YOLO26n-pose**를 선정하였다.

* 높은 Faint Recall
* 높은 F1
* 더 많은 LSTM 시퀀스 확보
* Zero Sequence Clip 감소
* Threshold 0.3~0.5 구간의 안정성
* 반복 Seed 실험에서 낮은 성능 변동성

---

# 8. 실험 6: 30프레임 54차원 Motion Feature

## Situation

기존 51차원 입력은 한 프레임의 17개 키포인트에 대해 `x, y, confidence`만 사용했다.

```text
17 keypoints × 3 values = 51 dimensions
```

정적인 좌표만으로는 이미 누워 있는 사람과 실제로 쓰러지는 사람을 구분하기 어려웠다.

## Action

다음 동적 특징 3개를 추가하였다.

| 특징            | 의미             |
| ------------- | -------------- |
| `center_drop` | 신체 중심점의 수직 하강  |
| `velocity`    | 프레임 간 신체 이동 속도 |
| `torso_angle` | 몸통 기울기와 변화량    |

이에 따라 입력을 51차원에서 54차원으로 확장하였다.

## Result

| 지표           | 51차원 Baseline | 54차원 Motion |     변화 |
| ------------ | ------------: | ----------: | -----: |
| Faint Recall |       약 10.0% |   **69.3%** |   약 7배 |
| Precision    |         12.5% |   **16.8%** | +4.3%p |
| F1           |         11.1% |   **27.1%** | 약 2.5배 |

Threshold를 낮췄을 때 Recall은 다음 수준까지 증가했다.

* Threshold 0.4: 약 73%
* Threshold 0.3: 약 79%

이 실험은 정적인 관절 위치만 보는 것보다 움직임의 방향·속도·몸통 변화를 함께 사용하는 것이 Faint 탐지에 효과적이라는 근거를 제공했다.

다만 Precision이 16.8%로 낮았으므로 이 결과만으로 운영 적용을 결정하지 않았다.

> 이 실험은 초기 Validation 기반 진단 실험이다. 아래의 후기 `keypoint_bbox54` 평가와 입력 정의 및 데이터 조건이 다르므로 수치를 직접 비교해서는 안 된다.

---

# 9. 실험 7: 후기 51차원 대 54차원 특징 평가

## Situation

초기 Motion Feature 실험 이후, Bounding Box 정보를 포함한 `keypoint_bbox54` 특징을 구성하여 보다 성숙한 데이터 조건에서 재평가하였다.

## Action

51차원 Baseline과 54차원 모델을 같은 평가 조건에서 비교하였다.

## Result

| 지표        |   51차원 |       54차원 |      변화 |
| --------- | -----: | ---------: | ------: |
| Accuracy  | 89.20% | **93.45%** | +4.25%p |
| Precision | 88.10% | **92.80%** | +4.70%p |
| Recall    | 90.50% | **94.20%** | +3.70%p |
| F1        | 89.29% | **93.49%** | +4.20%p |
| FP        |    132 |     **81** |  51건 감소 |
| FN        |    108 |     **66** |  42건 감소 |

FP는 약 **38.6%**, FN은 약 **38.9% 감소**하였다.

Bounding Box 기반 특징 추가가 Faint에 대한 민감도만 높인 것이 아니라 오탐과 미탐을 동시에 줄이는 데 기여한 것으로 판단하였다.

## 적용 전 차단 사항

54차원 모델의 성능은 유망했지만 다음 문제가 남아 있어 즉시 운영 모델로 승격하지 않았다.

* 학습·평가 Cache에 51→54 Zero Padding Fallback 존재
* Hard Negative 후보의 원본 Label Interval 검증 부족
* `source_video` 및 `frame_range` 검증 부족
* 실제 운영 데이터셋 기반 검증 미완료
* 51차원 모델과 54차원 모델의 Feature Schema 혼용 위험

확인된 Preflight 결과는 다음과 같다.

* Dummy Input `(1, 30, 54)` Forward 성공
* Feature Vector 길이 54 확인
* RTSP Preflight에서 `input_size=54` 확인
* 기존 51차원 Smoke Test 통과

따라서 현재 상태는 **운영 교체 완료가 아니라 후보 모델 검증 단계**로 정의하였다.

---

# 10. 실험 8: RTSP 4채널 실시간 처리

## Situation

단일 영상 성능만으로는 실제 다중 CCTV 환경의 처리 능력을 판단하기 어려웠다.

## Action

4개 RTSP 카메라에서 각각 3,000프레임을 처리하였다.

## Result

| 카메라      | Frames |  BBox | BBox/Frame | Sequence |    FPS |    YOLO |    LSTM |
| -------- | -----: | ----: | ---------: | -------: | -----: | ------: | ------: |
| Camera 1 |  3,000 | 4,416 |      1.472 |      716 | 29.688 | 6.391ms | 0.417ms |
| Camera 2 |  3,000 | 4,408 |      1.469 |      718 | 29.733 | 6.374ms | 0.417ms |
| Camera 3 |  3,000 | 8,554 |      2.851 |      749 | 29.741 | 6.500ms | 0.412ms |
| Camera 4 |  3,000 | 9,131 |      3.044 |      749 | 29.655 | 6.105ms | 0.397ms |

### 전체 요약

* 총 처리 프레임: **12,000**
* 총 BBox Detection: **26,509**
* 총 LSTM Sequence/Prediction: **2,932**
* 평균 Effective FPS: **29.70 FPS**
* 평균 YOLO 지연: **6.34ms**
* 평균 LSTM 지연: **0.41ms**

4개 카메라 모두 약 30 FPS에 가까운 처리 속도를 기록하였다.

당시 GPU 사용률은 약 15% 수준이었으며, 영상 멈춤의 주요 원인은 GPU 추론보다 다음 구간으로 판단하였다.

* 중복 FFmpeg 프로세스
* RTSP 인코딩
* Python Overlay 서버
* MJPEG JPEG 인코딩
* 브라우저의 4개 Stream 동시 렌더링

---

# 11. 실험 9: Tracking 및 Bounding Box 안정화

## Situation

짧은 Detection 누락마다 Track이 사라지거나 동일 인물의 Track ID가 변경되고, Bounding Box가 프레임마다 흔들렸다.

## Action

다음 파라미터를 적용하였다.

| 파라미터                        |    값 |
| --------------------------- | ---: |
| `track-thresh`              | 0.10 |
| `match-thresh`              | 0.20 |
| `track-buffer`              |   45 |
| `min-box-area`              |  100 |
| `bbox-smoothing-alpha`      | 0.60 |
| `track-max-missing-seconds` |  3.0 |

추가로 다음 구조를 적용하였다.

* 짧은 Detection 누락 시 Track 유지
* IoU 기반 기존 Track 재연결
* Bounding Box EMA Smoothing
* Raw BBox와 Smoothed BBox 분리 저장
* `new_tracks`, `lost_tracks`, `id_switch_like_events` 진단값 추가
* Tracked BBox와 원본 Detection을 IoU로 다시 매칭하여 올바른 Keypoint 연결

내부 Track ID가 70·80 이상으로 증가하는 문제는 추적 오류와 화면 표시 문제를 분리하기 위해 다음처럼 설계하였다.

```text
raw_track_id = 내부 추적 및 진단용
display_id   = 관제 화면 표시용
```

현재 문서에는 이 단계의 ID Switch 감소율이나 MOTA·IDF1 측정값이 기록되어 있지 않다. 따라서 이 작업은 **Tracking 정확도 향상 완료**가 아니라 **Tracking 안정화 로직 및 계측 기반 구축**으로 표현하는 것이 정확하다.

---

# 12. 실험 10: TensorRT 적용

## Situation

YOLO Pose 추론 지연을 줄이기 위해 TensorRT를 검토했지만, 모델 추론 개선이 실제 스트리밍 처리량 개선으로 이어지는지 별도로 확인해야 했다.

## 12.1 단일 영상 결과

| 지표          | PyTorch |    TensorRT |            개선 |
| ----------- | ------: | ----------: | ------------: |
| 평균 YOLO 지연  | 7.022ms | **3.839ms** | **45.33% 감소** |
| P95 YOLO 지연 | 8.537ms | **4.896ms** | **42.65% 감소** |
| 처리 FPS      |  84.278 | **119.544** | **41.85% 증가** |
| YOLO 추론 속도  |      기준 |  **1.829배** |            향상 |

단일 영상에서는 TensorRT의 효과가 명확했다.

## 12.2 실제 RTSP cam_05 결과

| 지표            | PyTorch |    TensorRT |            변화 |
| ------------- | ------: | ----------: | ------------: |
| 평균 YOLO 지연    | 7.679ms | **4.545ms** | **40.81% 감소** |
| Effective FPS |  14.855 |      14.799 |      0.38% 감소 |
| 전체 Runtime    | 201.95초 |     202.72초 |      0.38% 증가 |
| YOLO 추론 속도    |      기준 |  **1.689배** |            향상 |

실제 RTSP에서도 YOLO 추론 지연은 크게 줄었지만 Effective FPS는 사실상 동일했다.

## Result

TensorRT의 주요 효과는 전체 FPS 증가가 아니라 **YOLO Pose 추론 구간의 지연 감소와 GPU 처리 여유 확보**였다.

전체 파이프라인에는 다음 병목이 남아 있었다.

* 입력 영상 FPS 제한
* RTSP Read 및 Decode
* FFmpeg 송출
* MJPEG 인코딩
* 브라우저 렌더링
* Tracker 및 Overlay 처리

### 최종 적용 판단

```text
TensorRT: 선택형 Backend로 도입
PyTorch: 안정적인 Fallback으로 유지
```

운영 적용 전에는 다음 검증이 필요하다.

* PyTorch와 TensorRT Detection 결과 동등성
* Keypoint Confidence 분포 비교
* Threshold 동등성
* 실제 Worker가 `actual_backend=tensorrt`인지 확인
* 동일 조건의 End-to-End Alert Latency 및 Frame Drop 비교

---

# 13. 실험 11: Self-Improving Error Mining

## Situation

모델이 틀린 데이터를 무조건 재학습에 넣으면 Label 오류나 잘못된 Frame Range로 인해 데이터셋이 오염될 수 있었다.

## Action

예측값과 정답을 비교하여 오류 유형을 다음과 같이 분리하였다.

| 유형                | 조건                            | 저장 위치         | 목적        |
| ----------------- | ----------------------------- | ------------- | --------- |
| FP                | 예측 Faint, 정답 Normal           | Hard Negative | 오탐 감소     |
| FN                | 예측 Normal, 정답 Faint/Fall      | Reinforcement | 미탐 감소     |
| 검증 실패             | Label·Source·Frame·Feature 오류 | Quarantine    | 데이터 오염 방지 |
| Synthetic Preview | 승인된 54차원 후보 변형                | Preview Only  | 증강 검토     |

Synthetic Preview에는 다음 변형을 적용하였다.

* Keypoint Noise
* BBox Scale Jitter
* BBox Aspect Jitter
* Confidence Drop
* Frame Drop
* Temporal Jitter
* Horizontal Flip

Synthetic Data는 자동으로 Train Set에 병합하지 않았다.

```text
auto_merge_to_train = false
review_status = preview_only
```

## 다음 비교 실험

동일한 Evaluation Split에서 다음 실험군을 비교하도록 설계하였다.

* A: 기존 Baseline
* B: 54차원 Baseline
* C: 54차원 + Hard Negative 5%
* D: 54차원 + Hard Negative 10%
* E: 54차원 + Hard Negative 20%

Hard Negative의 성공 여부는 Accuracy만으로 판단하지 않고 다음을 함께 확인해야 한다.

* FP가 얼마나 감소했는가
* FN이 증가하지 않았는가
* Faint Recall이 크게 감소하지 않았는가
* Source Video별 성능이 개선되었는가
* 특정 환경에만 과적합하지 않았는가

---

# 14. 실험 12: LSTM 입력 규격 정합성

## Situation

실행 경로마다 Sequence 설정이 달랐다.

| 실행 경로                     | Sequence Length | Stride |
| ------------------------- | --------------: | -----: |
| Train LSTM                |              16 |      8 |
| Registered Camera Runtime |               8 |      4 |
| Dataset Evaluation        |               8 |      4 |
| Config/Main               |              30 |  확인 필요 |
| Keypoint Sequence Buffer  |              16 |      8 |
| Per-Track Buffer          |               8 |      4 |

또한 다음 차원 오류가 발생하였다.

```text
Expected input_size=51, got 54
```

## Action

시간 축 설정과 Feature 차원을 분리하여 관리하도록 정리하였다.

```text
sequence_length = 30
sequence_stride = 15

51D:
17 keypoints × (x, y, confidence)
Input shape = (Batch, 30, 51)

54D:
Input shape = (Batch, 30, 54)
```

체크포인트의 `input_size`, `sequence_length`, `feature_schema`와 실시간 Feature Builder가 일치하지 않으면 즉시 실패하도록 하는 것이 안전하다.

묵시적인 Zero Padding은 실행은 가능하게 만들지만 실제로는 학습하지 않은 특징을 입력하므로 제거하거나 Hard Fail로 전환해야 한다.

---

# 15. 실험 13: Overlay Frame Sync 및 Evidence Chain

## Situation

브라우저에서 다음 값이 `n/a`로 표시되었다.

```text
frameId=n/a
capturedAtMs=n/a
publishedAtMs=n/a
networkLatencyMs=n/a
endToEndLatencyMs=n/a
bufferSize=1
```

영상은 WebRTC/HLS/MJPEG로 이동하고 AI Metadata는 MQTT와 WebSocket으로 이동하기 때문에, 두 경로의 지연 차이로 과거 Bounding Box가 현재 영상 위에 그려질 수 있었다.

## Action

AI Payload에 다음 필드를 추가하였다.

* `frameId`
* `capturedAtMs`
* `processedAtMs`
* `publishedAtMs`
* `aiLatencyMs`
* `publishLatencyMs`
* `droppedFrameCount`
* `latencyOrderValid`
* `evidenceId`
* `traceId`

Evidence 식별자는 다음 형식으로 통일하였다.

```text
evidenceId = {cameraLoginId}-{frameId}-{capturedAtMs}
traceId = evidenceId
```

프론트 Overlay Buffer 기본값은 다음과 같다.

| 설정              |       값 |
| --------------- | ------: |
| Overlay Delay   |   300ms |
| Max Buffer Age  | 5,000ms |
| Max Buffer Size |     300 |
| Match Threshold |   200ms |

AI 진단 테스트 결과:

* 테스트 2개 실행
* 2개 통과
* `classification=sync_fields_present`
* 예상 Buffer Size 2
* Evidence ID 생성 확인

다만 실제 브라우저의 Live STOMP Payload와 영상 간 Runtime Drift 검증은 아직 완료되지 않았다.

---

# 16. 영상 송출 방식 실험과 의사결정

MJPEG의 CPU 부하를 줄이기 위해 WebRTC와 GStreamer 기반 구조를 약 2주간 검토하였다.

장기적으로 GStreamer는 다음 장점이 있다.

* Frame PTS 활용
* RTP Timestamp 처리
* RTCP Sender Report 기반 촬영 시각 추정
* 정확한 영상·Metadata 동기화

그러나 프로젝트 일정 내에서는 RTSP Source, MediaMTX, AI Worker, Frontend를 동시에 수정해야 하는 리스크가 컸다.

따라서 시연 단계에서는 다음 결정을 내렸다.

```text
주 영상 송출: 제한된 MJPEG
GStreamer/WebRTC: 후속 고도화
AI 결과 전달: MQTT Metadata 유지
VLM: 실시간 Loop가 아닌 이벤트 Snapshot/Clip 후처리
```

MJPEG 경량화 설정은 다음을 기준으로 하였다.

```text
stream_fps = 15
output_width = 640
jpeg_quality = 70
latest-frame 우선
오래된 프레임 drop
느린 Client와 AI 추론 Loop 분리
```

이는 기술적 후퇴가 아니라, 제한된 기간 내에서 탐지 파이프라인과 시연 안정성을 우선한 의사결정이다.

---

# 17. 최종 기술 의사결정

| 영역             | 결정                     | 상태                  |
| -------------- | ---------------------- | ------------------- |
| Pose Extractor | YOLO26n-pose           | 선정                  |
| 최우선 평가 지표      | Faint Recall → F1 → 오탐 | 확정                  |
| LSTM 시간 문맥     | 30프레임, Stride 15 기준    | 정합성 추가 검증 필요        |
| 54차원 특징        | 성능 유망                  | 운영 승격 전 검증 필요       |
| TensorRT       | 선택형 Backend            | PyTorch Fallback 유지 |
| 4채널 처리         | 평균 29.70 FPS           | 달성                  |
| Tracking       | Buffer·IoU·EMA 적용      | IDF1 등 정량평가 필요      |
| Hard Negative  | FP/FN 분리 수집            | 비율별 재학습 필요          |
| 영상 송출          | 경량 MJPEG 우선            | WebRTC/GStreamer 후속 |
| VLM            | 이벤트 후처리                | 실시간 Loop 미적용        |
| Evidence Chain | Evidence ID 기반         | Live 통합검증 필요        |

---

# 18. 핵심 성과 요약

## 모델 선정 성과

* Faint Recall: **66.00% → 86.44%**
* F1: **56.90% → 64.97%**
* 반복 Seed F1 표준편차: **0.0803 → 0.0222**
* Zero Sequence Clip: **15 → 9**

## 특징 확장 성과

* 후기 Accuracy: **89.20% → 93.45%**
* 후기 F1: **89.29% → 93.49%**
* FP: **132 → 81**
* FN: **108 → 66**

## 실시간 처리 성과

* 4채널 총 처리: **12,000프레임**
* 평균 처리 속도: **29.70 FPS**
* YOLO 평균 지연: **6.34ms**
* LSTM 평균 지연: **0.41ms**

## 추론 최적화 성과

* 단일 영상 평균 YOLO 지연: **45.33% 감소**
* 단일 영상 P95 지연: **42.65% 감소**
* 단일 영상 처리 FPS: **41.85% 증가**
* 실제 RTSP YOLO 지연: **40.81% 감소**
* 실제 RTSP End-to-End FPS: **사실상 동일**

---

# 19. 한계

1. 초기 모델 선정 실험은 비교적 적은 수의 영상으로 수행되었다.
2. 초기 54차원 Motion Feature 실험과 후기 `keypoint_bbox54` 실험의 조건이 서로 다르다.
3. YOLO26n-pose는 Faint에 민감하여 오탐 위험이 있다.
4. 54차원 경로의 Zero Padding Fallback이 완전히 제거되지 않았다.
5. Tracking 개선에 대한 MOTA, IDF1, ID Switch 등의 정량 지표가 없다.
6. TensorRT는 모델 추론을 개선했지만 전체 Streaming 병목을 해결하지 못했다.
7. WebRTC/HLS 화면과 Overlay의 실제 Runtime Drift는 완전 검증되지 않았다.
8. Hard Negative 재학습 효과는 승인된 실제 오류 데이터가 충분히 쌓인 뒤 판단해야 한다.

---

# 20. 다음 실험

## 모델 성능

* 동일 Source Video Split에서 51D와 54D 재평가
* Hard Negative 0%·5%·10%·20% 비교
* Seed 5회 이상 반복
* Threshold 0.3~0.7 재탐색
* 연속 Faint 1·2·3회 조건 비교
* Cooldown 0·10·30초 비교

## 환경별 평가

* Indoor Background
* Indoor Chroma Key
* Outdoor
* 주간·야간
* 카메라별
* 장소별
* 계절별

## Tracking

* ID Switch
* Track Fragmentation
* IDF1
* Track 유지 시간
* Hard·Soft·Sole Match 비율
* Detection 누락 후 재연결 성공률

## Runtime

* PyTorch와 TensorRT 동일 입력 비교
* 평균·P50·P95 추론 지연
* End-to-End Alert Latency
* Frame Drop
* CPU·GPU·VRAM
* 4·6·8채널 확장성

## 통합 검증

* `actual_backend=tensorrt` 확인
* Video EOF에서 Worker와 Tracker 상태 초기화
* 새 영상 시작 시 Sequence 및 Event Lifecycle 초기화
* MQTT→Backend→DB→Frontend 이벤트 일관성
* Evidence ID와 Snapshot·Clip·운영자 피드백 연결

---

# 21. 결론

본 프로젝트는 가장 빠른 Pose 모델을 선택하는 대신, **실제 안전 관제 목적에 맞게 Faint Recall과 Downstream LSTM 성능을 기준으로 YOLO26n-pose를 선정**하였다.

이후 54차원 특징 확장으로 자세뿐 아니라 움직임 또는 Bounding Box 정보를 반영하여 분류 성능을 개선했으며, RTSP 4채널에서 평균 29.70 FPS를 확인하였다.

TensorRT를 통해 YOLO 추론 지연을 40% 이상 줄였지만 전체 FPS는 거의 변하지 않았다. 이를 통해 현재 주요 병목이 GPU가 아니라 RTSP 입력, FFmpeg, MJPEG 인코딩, 브라우저 렌더링에 있다는 사실을 구분하였다.

또한 Hard Negative, FN Reinforcement, Quarantine, Evidence ID 구조를 추가하여 단순 모델 학습을 넘어 운영 중 발생하는 오류를 검증 가능한 재학습 데이터로 전환할 수 있는 기반을 구축하였다.

최종적으로 현재 시스템은 다음 단계에 도달하였다.

> **YOLO26n-pose + LSTM 기반 Faint 탐지 모델을 선정하고, 4채널 실시간 처리·TensorRT 선택형 추론·54차원 특징 확장·오류 수집 및 Evidence Chain을 결합한 운영형 영상 AI 파이프라인으로 고도화하였다.**
