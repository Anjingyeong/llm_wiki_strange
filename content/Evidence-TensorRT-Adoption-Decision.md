---
title: TensorRT Adoption Decision Evidence
navTitle: TensorRT Adoption
shortTitle: TensorRT
category: Project
tags: [portfolio, evidence, ai, tensorrt, yolo, performance, decision]
relatedDocs: [AI-Pipeline, Model-Decision-YOLO26n, Benchmark-History, Realtime-Camera-Runtime-Stabilization]
relatedFiles: [strange_ai/docs/tensorrt_adoption_evidence.md, strange_ai/scripts/compare_tensorrt_candidate.py, strange_ai/scripts/run_4cam_rtsp_metrics.sh, strange_ai/scripts/start_ai_stable.sh]
updatedAt: 2026-07-14
project: smart-safety-ai
type: evidence
portfolio_use: true
evidence_type: decision
---

## 1. 문제 정의

실시간 Faint 탐지 파이프라인에서 객체 및 관절 키포인트를 검출하는 YOLO 추론은 GPU 연산 오버헤드가 가장 무겁고 지연 시간(Latency)이 긴 병목 구간입니다.
전체 분석 프레임 레이트(Effective FPS)를 높이고 경보 반응 속도(Alert Latency)를 최적화하기 위해, TensorRT 가속 엔진을 적용하여 지연 시간을 감소시키는 시도를 설계하였습니다.

## 2. 실제 관찰 및 원인

YOLO 추론 지연은 TensorRT 적용으로 극적으로 감소하였으나, 실제 RTSP 다중 스트림 환경에서의 실질적인 처리 레이트(Effective FPS)는 거의 개선되지 않는 현상이 관찰되었습니다.
원인은 전체 파이프라인의 주요 병목이 GPU 연산 자체에만 있지 않고, RTSP 수신 국면의 디코딩, FFmpeg 송출, Python MJPEG 인코딩, 네트워크 대역폭 및 브라우저 렌더링 구간 등의 입출력(I/O) 오버헤드에 고루 흩어져 있었기 때문입니다.

## 3. 내가 한 판단

1. **선택형 백엔드(Selectable Backend) 정책**: 실운영 환경의 안정성 확보를 위해 PyTorch 백엔드(`.pt`)를 상시 Fallback으로 기본 탑재하고, 명시적 설정 시에만 TensorRT 엔진(`.engine`)을 로딩하도록 분리하였습니다.
2. **동등성 검증(Equivalence Verification) 연계**: 단순 latency 단축에 만족하지 않고 PyTorch와 TensorRT 간의 프레임별 바운딩 박스 매칭 IoU, 검출 개수 편차, 관절 신뢰도 편차를 검증하는 동등성 감사를 필수화하였습니다 (`compare_tensorrt_candidate.py`).
3. **트래커 자가 복구 리셋(Tracker Reset Decision)**: 추론 가속화 시 발생할 수 있는 프레임 격차나 타임스탬프 스파이크를 방어하기 위해 리셋 조건(`FRAME_ID_RESET`, `LARGE_FRAME_GAP`, `LARGE_TIME_GAP`)을 정의하여 트래커를 자동 복구하도록 엮었습니다.

## 4. 구현 및 검증

현재 develop 런타임 코드(`detector/yolo_pose_detector.py` 및 `ai/inference/tensorrt_runtime.py`)에 TensorRT 엔진의 존재 여부 검사, 로딩 검증, PyTorch 폴백이 완전히 구현되어 벤치마크 및 실운영에서 작동합니다.

### 4.1 단일 비디오 추론 지연 비교
단일 비디오 파일 입력 조건에서의 PyTorch vs TensorRT 가속 성과입니다.

| 평가 지표 | PyTorch Baseline | TensorRT Engine | 개선율 |
| :--- | :---: | :---: | :---: |
| **평균 YOLO 지연** | 7.022ms | **3.839ms** | **45.33% 감소** |
| **P95 YOLO 지연** | 8.537ms | **4.896ms** | **42.65% 감소** |
| **처리 FPS** | 84.278 | **119.544** | **41.85% 증가** |
| **추론 속도 배율** | 기준 (1.0x) | **1.829배** | **82.9% 속도향상** |

### 4.2 실제 RTSP cam_05 런타임 지연 비교
실제 카메라 스트림 유입 상태에서의 런타임 실측 결과입니다.

| 평가 지표 | PyTorch Baseline | TensorRT Engine | 변화량 |
| :--- | :---: | :---: | :---: |
| **평균 YOLO 지연** | 7.679ms | **4.545ms** | **40.81% 감소** |
| **Effective FPS** | 14.855 | **14.799** | -0.38% (동일 수준) |
| **전체 실행시간** | 201.95초 | **202.72초** | +0.38% (동일 수준) |
| **추론 속도 배율** | 기준 (1.0x) | **1.689배** | **68.9% 속도향상** |

> [!WARNING]
> TensorRT는 YOLO 추론 시간 자체를 약 40.8% 감소시키고 GPU 마진을 확보해주지만, 전체 파이프라인의 실질 처리량(E2E Effective FPS)은 앞단의 RTSP 대역폭 및 백엔드 이미지 인코딩 병목으로 인해 14.8 FPS 부근으로 제한되어 사실상 변화가 없었습니다.

### 4.3 사전/사후 검증 항목
운영 승격 전 다음 검증을 필수 통과하도록 벤치마크 흐름을 구성하였습니다.
*   **검출 동등성**: 두 백엔드 간 bounding box IoU 매칭률 95% 이상.
*   **관절 신뢰도**: 키포인트 confidence 분포 편차 정렬.
*   **타겟 빌드 식별**: `actual_backend=tensorrt` 확인 기능.
*   **동기화 경보**: 가속 추론 시 프레임 드롭 및 Alert Latency 비교.

---

## 5. 한계 및 후속 작업

### 한계
- TensorRT 가속 엔진은 GPU 아키텍처에 강하게 종속되므로 빌드 머신과 타겟 장비의 GPU 아키텍처(Compute Capability)가 다르면 파일 로딩 자체가 거부되어 PyTorch Fallback으로 회귀합니다.
- RTX 5080 등 차세대 GPU 환경 배포 시 타겟 로컬 장비에서의 재빌드가 필수적입니다 (현재 미완료).

### 후속 작업
- **RTX 5080 엔진 재빌드**: 실서버 하드웨어 Compute Capability 규격에 맞게 TensorRT `.engine` 파일 재생성 및 이식 (미완료/후속 계획).
- **입출력(I/O) 병목 최적화**: GPU 외의 병목인 FFmpeg 디코딩 속도 및 MJPEG 스트리밍 경량화를 위한 HLS/WebRTC 마이그레이션.

---
#tensorrt #inference-speed #latency #backend #fall-back #evidence
