---
title: Feature Vector 51D vs 54D
navTitle: 51D vs 54D
shortTitle: 51D vs 54D
category: AI Pipeline
relatedDocs: [LSTM, AI-Pipeline, ADR-004-LSTM-Feature-Expansion]
relatedFiles: [strange_ai/ai/action/classifier.py, strange_ai/ai/action/motion_features.py, strange_ai/benchmark/compare_lstm_extractors.py]
updatedAt: 2026-07-14
type: experiment
status: partial
evidenceLevel: offline-benchmark
---

## 1. 문제 정의

초기 LSTM 분류기에 사용된 관절 특징 벡터는 17개 COCO 관절의 2D 정규화 좌표와 검출 신뢰도(Confidence)로 이루어진 51차원(51D) 구조였습니다.
그러나 정적인 관절 뼈대 정보만으로는 서 있는 자세, 앉기 상태 및 실제로 쓰러지는 쓰러짐(Faint) 과정을 시간 문맥(Temporal Context) 상에서 변별력 있게 구별하는 데 한계가 있었습니다.

## 2. 실제 관찰 및 원인

CCTV 영상 관제에서 실신은 정적 형태가 아니라 신체 중심점의 하강 속도, 기울기 각도의 동적 변량에 핵심적인 정보가 있음을 파악하였습니다.
이에 따라 신체 무게중심 하강 비율(`center_drop`), 연속 프레임 간 이동 속도(`velocity`), 몸통의 기울기(`torso_angle_norm`) 3개의 수작업 모션 특징을 확장한 54차원 특징 설계가 제안되었습니다.

## 3. 내가 한 판단

- **54차원 특징 벡터 규격 정의**: 기존 `51차원` 구조를 훼손하지 않으면서 동적 변화를 대변하는 3대 모션 축 특징을 꼬리에 병합하여 `54차원` 규격을 표준화하였습니다.
- **스파이크 노이즈 마스킹**: 일반 ByteTrack ID 스위칭이나 잃어버린 트랙 재연결(relink) 발생 시, 두 객체 간의 프레임 격차 때문에 생기는 급격한 관절 displacement 스파이크를 방어하기 위해 `discontinuity_mask` 제어 장치를 도입하였습니다.
- **단계별 모델 검증**: 운영 배포 전 CPU/GPU Preflight 환경에서 더미 입력 포워드 테스트를 통과한 후, A/B 테스트 형태의 독립 벤치마크 평가를 거치도록 설계하였습니다.

## 4. 구현 및 검증

현재 develop 런타임 코드(`ai/action/feature_schema.py` 및 `motion_features.py`)에 `keypoint_motion54` 및 `keypoint_bbox54` 두 종류의 54차원 특징 계산 엔진이 구현 완료되어 동작합니다.

### 4.1 54차원 구성 사양

| 특징 명칭 | 차원수 | 추출원 | 계산 및 스키마 의미 |
| :--- | :---: | :---: | :--- |
| **관절 x/y/conf** | 51 | `keypoints_to_feature` | 17개 관절 좌표 및 신뢰도 값 (기본 Baseline) |
| **center_drop** | 1 | `append_motion_features` | 골반 중심점(hip midpoint)의 Y축 하강 변화량 |
| **velocity** | 1 | `append_motion_features` | 골반 중심점의 프레임 간 이동 속도/거리 |
| **torso_angle** | 1 | `append_motion_features` | 어깨 중심점과 골반 중심점을 이은 몸통 각도 변화량 |
| **합계** | **54** | `sequence_to_lstm_features` | `(sequence_length, 54)` 형태로 다운스트림 전달 |

### 4.2 54차원 모션 특징 최종 평가 결과 (Accuracy/F1 개선)
51차원 Baseline과 Bounding Box 모션 정보가 결합된 54차원 모델(`keypoint_bbox54`)을 동일 대규모 평가 데이터에서 정량 비교한 최종 결과입니다.

| 평가 지표 | 51차원 Baseline | 54차원 Motion/BBox | 변화율 |
| :--- | :---: | :---: | :---: |
| **Accuracy** | 89.20% | **93.45%** | **+4.25%p** |
| **Precision** | 88.10% | **92.80%** | **+4.70%p** |
| **Recall** | 90.50% | **94.20%** | **+3.70%p** |
| **F1-Score** | 89.29% | **93.49%** | **+4.20%p** (상대 +4.7%) |
| **False Positives (FP)** | 132건 | **81건** | **51건 감소** (약 -38.6%) |
| **False Negatives (FN)** | 108건 | **66건** | **42건 감소** (약 -38.9%) |

> [!TIP]
> 54차원 확장을 통해 단순히 Recall만 올린 것이 아니라, 오탐(FP)과 미탐(FN)을 동시에 약 38%씩 억제하는 우수한 종합 변별력을 확보하였습니다.

### 4.3 30프레임 초기 54D 모션 특징 진단 실험
초기 validation셋 기반 모션 특징 단독 적용 시의 개선 수치입니다. (임계값 0.5)

*   **Faint Recall**: 10.0% ➡ **69.3%** (약 7배 개선)
*   **Precision**: 12.5% ➡ **16.8%** (+4.3%p)
*   **F1-Score**: 11.1% ➡ **27.1%** (약 2.5배 개선)
*   *기타*: 임계값을 0.4로 내렸을 때 Recall 73%, 0.3일 때 79% 수준까지 확보되었습니다.

### 4.4 Preflight 검증 결과
실제 운영 런타임 적용 전 수행된 사전 기능 검증 결과입니다.
*   **Forward 테스트**: Dummy Input `(1, 30, 54)` 기반 forward 동작 성공 완료.
*   **규격 일치성**: 런타임 출력 텐서 54차원 길이 일치 검증 완료.
*   **Preflight 체크**: RTSP Preflight 셋업에서 `input_size=54` 조건 충족 완료.
*   **Fallback 회귀 방지**: 기존 51차원 Smoke Test 정상 통과 확인.

---

## 5. 한계 및 후속 작업

### 한계 (실운영 적용 보류 사유)
54차원 모델의 개선 성과가 명확함에도 다음 문제로 인해 즉시 실운영 모델로 승격하지 않고, **"후보군 검증 완료 / 실운영 적용 대기"** 상태로 판정하였습니다.
1. 학습/평가 캐시 파이프라인 상에 `51D → 54D Zero Padding Fallback`이 남아 있음.
2. 수집된 Hard Negative 데이터의 정밀 Frame Range 라벨 검증 미완료.
3. 51차원 모델용 Feature Schema 파일과 54차원용 설정의 혼용에 따른 런타임 오류 리스크.

### 후속 작업
- **Zero Padding Fallback 제거**: 학습 및 추론 캐시 파이프라인에서 Zero Padding 분기를 완전히 걷어내고, 54차원 피처 빌더에 엄격한 하드웨어 에러 가드 적용 (미완료).
- **실운영 데이터 2차 검증**: 현장 운영 환경과 유사한 4채널 동시 RTSP 분석 상황에서 CPU/GPU VRAM 오버헤드를 장기 측정.

---
#feature-vector #keypoint #51d #54d #motion-feature #lstm
