---
title: TensorRT Adoption Decision Evidence
navTitle: TensorRT Adoption
shortTitle: TensorRT
category: Project
tags: [portfolio, evidence, ai, tensorrt, yolo, performance, decision]
relatedDocs: [AI-Pipeline, Model-Decision-YOLO26n, Benchmark-History, Realtime-Camera-Runtime-Stabilization]
relatedFiles: [strange_ai/docs/tensorrt_adoption_evidence.md, strange_ai/scripts/compare_tensorrt_candidate.py, strange_ai/scripts/run_4cam_rtsp_metrics.sh, strange_ai/scripts/start_ai_stable.sh]
updatedAt: 2026-07-09
project: smart-safety-ai
type: evidence
portfolio_use: true
evidence_type: decision
---

# TensorRT 도입 및 트래커 리셋 연동 판단 기록

## 1. 문제 정의

실시간 CCTV 이상행동 감지 파이프라인에서 YOLO Pose 추론은 가장 무거운 구간입니다. TensorRT를 적용하여 지연시간(Latency)과 FPS 성능을 개선하는 것은 중요한 목표이지만, 다음과 같은 운영 안정성 및 정합성 리스크가 있었습니다.

- **지연시간/FPS 개선만으로는 부족한 운영 신뢰성**: 모델 성능 개선 수치보다 중요한 것은 PyTorch 모델(`.pt`)과 TensorRT engine(`.engine`) 간의 추론 결과 정합성입니다. 두 백엔드 간의 검출 개수, Bounding Box 좌표, Keypoint 신뢰도 차이는 후속 ByteTrack(객체 추적) 및 LSTM(행동 분류)의 시퀀스 구성을 흔들어 최종 이벤트 판정 결과의 불일치를 초래할 수 있습니다.
- **ByteTrack track_id 유실(Fragmentation)과 관측 가능성(Observability) 부족**: RTSP 카메라 스트림의 일시 단절 및 재연결(Reconnect), 프레임 드롭(dropped frame), 타임스탬프 역전, 큰 프레임 격차(Frame gap) 등은 ByteTrack의 추적 상태를 쉽게 교란하여 `track_id` 유실이나 이탈 감지 오작동을 유발합니다. 기존 시스템은 트래커의 초기화(reset) 시점과 상태가 불분명하게 처리되어 운영 중 상태 변화를 디버깅하기 매우 어려웠습니다.

## 2. 내가 한 판단

- **Torch 기본 백엔드 유지 및 TensorRT 명시적 선택 구조(Selectable Backend)**: TensorRT 가속을 기본 사양으로 채택하되, 라이브러리 비호환이나 GPU VRAM 부족 등 비상시 안전한 구동을 위해 PyTorch를 기본 Fallback 백엔드로 유지하고 명시적으로 선택할 때만 `.engine`을 로드하도록 제약했습니다.
- **지연시간 비교를 넘어선 '동등성 검증(Equivalence Verification)' 도입**: 단순 latency 측정 벤치마크 루프를 확장하여, 동일 비디오 프레임에 대해 Torch와 TensorRT의 바운딩 박스 매칭 및 IoU, 검출 개수 오차, 키포인트 신뢰도 오차, 이벤트 발령 유무 차이 등을 프레임 단위로 수집하고 정량 비교 리포트를 뽑도록 벤치마크 플로우를 재설계했습니다.
- **트래커 ID 유실을 런타임 흐름의 관측성(Observability) 문제로 재정의**: `track_id` 유실 문제를 단순한 매칭 임계치(threshold) 튜닝으로 접근하지 않고, 스트림 격차 흐름을 추적하여 상태가 정상 유지(`kept`), 리셋(`reset`), 혹은 스킵(`skipped`)되었는지에 대한 판정 로그를 명확히 출력하도록 설계했습니다.
- **감춤 없는 트래커 리셋(Tracker Reset) 자가 복구 메커니즘 정립**: 큰 프레임 유실이나 스트림 리셋이 생겼을 때 트래커 상태를 억지로 보존하기보다는, 시스템 비정상 흐름을 명확히 판단하여 트래커를 공식 리셋하고 오탐을 방지하는 자가 복구 흐름을 정의했습니다.

## 3. 그 결과 바뀐 점

### scripts/compare_tensorrt_candidate.py (동등성 연계 및 리포트 작성)
- **`get_yolo_detections()` 구현**: PyTorch 모델과 TensorRT 엔진으로부터 프레임별 예측 결과(bbox xyxy, conf, keypoint confidence 평균 등)를 독립적으로 수집하는 헬퍼 함수를 구현했습니다.
- **`main()` 동등성 분석 연동**: 두 백엔드 벤치마크가 모두 "OK"로 종료된 경우, `compare_detection_equivalence` 함수를 호출하여 프레임별 IOU, 검출 카운트 차이, 키포인트 및 이벤트 결정 차이 데이터를 산출하도록 연동했습니다.
- **자동 리포트 저장**: 수집된 동등성 검증 지표를 `benchmark/results/tensorrt_candidate/` 디렉토리 하위에 CSV(`tensorrt_equivalence_report.csv`) 및 마크다운(`tensorrt_equivalence_report.md`) 리포트로 자동 생성해 저장하도록 반영했습니다.
- **안정적인 벤치마크 흐름**: TensorRT 엔진 파일이 존재하지 않는 경우 기존 `DEFER` 상태를 반환하고, Torch 단독 베이스라인 벤치마크는 실패 없이 안전하게 처리하도록 리스크를 격리했습니다.

### scripts/serve_ai_overlay.py (재연결 및 프레임 갭 트래커 리셋 연동)
- **프레임 상태 추적**: `_run()` 스레드 내부에 `last_frame_id` 및 `last_captured_at_ms` 상태 보존 로직을 추가했습니다.
- **트래커 자가 복구/리셋 조건 구현**: 
  - 프레임 인덱스가 역전되는 경우(`FRAME_ID_RESET`),
  - 프레임 캡처 시간 격차가 3000ms를 초과하는 경우(`LARGE_TIME_GAP`),
  - 프레임 인덱스 갭이 90프레임을 초과하는 경우(`LARGE_FRAME_GAP`)를 실시간 감지하여 트래커를 새롭게 재생성(`tracker = create_detection_postprocessor(self.args)[0]`)하도록 리셋했습니다.
- **실시간 리셋 의사결정 로그 연동**: 
  - 리셋이 결정되면 `log_tracker_reset_decision()` 및 `build_tracker_reset_record`를 호출하여 리셋 사유(`reason`), 카메라 로그인 ID, 프레임 ID, 프레임 갭, 트래커 인스턴스 해시 ID(`tracker_object_id`)를 출력하도록 엮었습니다.
  - 디버그 환경(`TRACKING_DEBUG=true`)인 경우, 트래커 상태가 안정적으로 유지되는 일반 상황(`reset=False`, `reason=FRAME_GAP_OK`) 역시 로깅하여 런타임 제어 정합성을 확보했습니다.

### 검증 완료 증거
- **컴파일 문법 검사**: 수정된 `compare_tensorrt_candidate.py` 및 `serve_ai_overlay.py` 파일의 파이썬 구문 오류(Syntax) 체크를 무사히 통과했습니다.
- **단위 테스트 통과**: `tests/test_compare_tensorrt_candidate.py` 파일 내에 정의된 6개의 동등성 비교 단위 테스트를 전원 통과(`OK`)했습니다.

## 4. 안전 가이드라인 및 제약 사항

- **TensorRT의 전면적인 실운영 도입 보류**: 지연시간 단축 효과와 동등성 검증을 마쳤으나, 런타임 상에서 모델과 하드웨어 백엔드의 완전성(Operational Adoption)은 필드 모니터링이 추가로 필요합니다.
- **트래커 ID 유실 한계 인정**: 리액티브 트래커 리셋 메커니즘을 적용하여 비정상 흐름 오탐은 막았지만, ByteTrack ID 유실 자체를 근본적으로 막아낸 것은 아닙니다. 
- **추가 런타임 관측**: 잦은 리셋이 발생하면 오히려 추적이 파편화되므로, 필드에서의 리셋 빈도와 `personSessionId` 재연결 성공률 지표는 추후 현장 운영 로그 분석을 통해 정밀 최적화해야 합니다.
- **임계치 스윕(Threshold Sweep) 미포함**: 이번 단계는 동등성 검증 연계 및 리커버리 로그 구현에 한하며, 디텍터/매치/버퍼 등 학습 단계의 임계값 그리드 스윕 기능은 본 최적화 범위에 포함되지 않았습니다.

## 5. 현재 결론

TensorRT 가속에 따른 추론 지연시간 단축 효과는 검증되었으며, PyTorch-TensorRT 간의 실질적인 검출 동등성을 프레임 단위로 측정할 수 있는 시스템 기반을 마련했습니다. 또한, RTSP 재연결 및 대량 프레임 유실 상황에서 발생하는 트래커 이상 작동을 방어하기 위해 자가 복구 리셋(Reset Decision) 로그를 투명하게 수집함으로써 관제 시스템의 런타임 관측 효율성을 크게 향상시켰습니다.
