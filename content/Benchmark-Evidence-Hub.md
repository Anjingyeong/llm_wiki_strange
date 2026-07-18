---
title: Pipeline Stabilization Benchmark Evidence Hub
navTitle: 벤치·근거 허브
shortTitle: 벤치 허브
displayTitle: 파이프라인 안정화 벤치 요약
category: Evidence
tags: [portfolio, evidence, benchmark, tensorrt, tracking, lstm, mqtt, rtsp, vlm, rag]
relatedDocs:
  - Develop-Code-Baseline-2026-07-15
  - AI-Pipeline
  - Evidence-TensorRT-Adoption-Decision
  - Evidence-RTSP-2Cam-Queue-TensorRT
  - Evidence-MQTT-E2E-Alert-Latency
  - Feature-Vector-51D-vs-54D
  - Tracking-Association-Offline-AB-2026-07-13
  - Tracking-Association-Stabilization
  - Evidence-VLM-RAG-Event-Search-Decision
  - ED-Snapshot-VLM-Side-Channel
  - VLM-RAG-DBless-Mock-MVP
  - Evidence-LLM-Wiki-RAG
relatedFiles:
  - ai-pipeline-stabilization-source.md
updatedAt: 2026-07-16
project: smart-safety-ai
type: evidence
status: partial
evidenceLevel: offline-benchmark
portfolio_use: true
evidence_type: hub
canonicalFor: stabilization-benchmark-index
---

> **RAG 한 줄:** 조건마다 숫자가 다르다. 질문 유형별 canonical Evidence는 §2; 수치·조건·한계는 §3.

## 2. 질문별 canonical 문서

| 질문 예시 | 먼저 볼 문서 |
| --- | --- |
| TensorRT offline 3000f FPS·YOLO ms | §3.1 + Evidence-TensorRT-Adoption-Decision |
| 2-cam RTSP queue | Evidence-RTSP-2Cam-Queue-TensorRT |
| MQTT E2E 지연 | Evidence-MQTT-E2E-Alert-Latency |
| 51D vs 54D FN/FP/F1 | Feature-Vector-51D-vs-54D |
| Tracking offline M_I | Tracking-Association-Offline-AB-2026-07-13 |
| VLM 클립·worker·eventId lock | VLM-RAG-DBless-Mock-MVP stabilization § |
| 스냅샷·UI 폴링 | ED-Snapshot-VLM-Side-Channel |

## 3. 조건별 수치 요약 (RAG 평문)

| 조건 | 지표 | 기준 | 결과 | 변화/비고 |
| :--- | :--- | :--- | :--- | :--- |
| YOLO26n Pose, 51D LSTM, sequence length 30, stride 15, 단일 영상 3000프레임 offline | 전체 처리 시간 | PyTorch 26.72초 | TensorRT 15.32초 | 42.69% 감소 |
| YOLO26n Pose, 51D LSTM, sequence length 30, stride 15, 단일 영상 3000프레임 offline | Offline 처리량 | PyTorch 112.26 FPS | TensorRT 195.87 FPS | 74.48% 증가 |
| YOLO26n Pose, 51D LSTM, sequence length 30, stride 15, 단일 영상 3000프레임 offline | YOLO 평균 지연 | PyTorch 7.02ms | TensorRT 3.82ms | 45.54% 감소 |
| YOLO26n Pose, 51D LSTM, sequence length 30, stride 15, 단일 영상 3000프레임 offline | 비교 한계 | 단일 영상 offline | 다중 RTSP 수치 | 직접 비교하면 안 된다 |

| 조건 | 지표 | PyTorch | TensorRT | 변화/비고 |
| :--- | :--- | :---: | :---: | :--- |
| 2-cam RTSP cam_03과 cam_04 동시 처리, 카메라별 Frame Queue 크기 3 Latest Frame 정책, 총 3600프레임 | Aggregate 처리량 | 28.701 FPS | 28.339 FPS | 유사 |
| 2-cam RTSP cam_03과 cam_04 동시 처리, 카메라별 Frame Queue 크기 3 Latest Frame 정책, 총 3600프레임 | YOLO 평균 지연 | 9.454ms | 4.723ms | 약 50% 감소 |
| 2-cam RTSP cam_03과 cam_04 동시 처리, 카메라별 Frame Queue 크기 3 Latest Frame 정책, 총 3600프레임 | dropped frames | 40 | 34 | 감소 |
| 2-cam RTSP cam_03과 cam_04 동시 처리, 카메라별 Frame Queue 크기 3 Latest Frame 정책, 총 3600프레임 | 처리량 상한 | RTSP 입력 약 14.5 FPS per camera | RTSP 입력 약 14.5 FPS per camera | 전체 처리량 상한 |

| 조건 | 지표 | A_current | M_I_hybrid_kp_safe | 변화/비고 |
| :--- | :--- | :---: | :---: | :--- |
| Tracking offline | ID Switch | 8건 | 1건 | 87.5% 감소 |
| Tracking offline | 다중 객체 ID 집합 변화 | 39 | 0 |  |
| Tracking offline | Mean Track Coverage | 0.3576 | 0.4970 | 약 39% 증가 |
| Tracking offline | Mean Track Purity | 0.6883 | 0.5122 | 감소. 다중 객체 프레임에서 사람을 왼쪽부터 P1·P2로 구분하는 Pseudo Identity 보조지표이며, 교차·좌우 위치 변경 시 실제 ID 유지 여부와 무관하게 낮아질 수 있다. 정식 Ground Truth 기반 Tracking Accuracy가 아니다. live canary는 Tracking-Association-Stabilization 문서를 본다. |

| 조건 | 지표 | 이전 | 이후 | 변화/비고 |
| :--- | :--- | :---: | :---: | :--- |
| 54D motion feature 동일 평가 | Accuracy | 89.20% | 93.45% |  |
| 54D motion feature 동일 평가 | F1 | 89.29% | 93.49% |  |
| 54D motion feature 동일 평가 | False Negative | 108 | 66 | 42건, 약 38.9% 감소 |
| 54D motion feature 동일 평가 | False Positive | 132 | 81 | 51건, 약 38.6% 감소 |

| 조건 | 지표 | 값 | SLA/비고 |
| :--- | :--- | :--- | :--- |
| 2-cam TensorRT 환경, 29 이벤트 기준 | MQTT End-to-End Alert Latency E2E 평균 | 20.931ms | 29/29, 100%가 1초 SLA 이내 |
| 2-cam TensorRT 환경, 29 이벤트 기준 | p95 | 26ms | 29/29, 100%가 1초 SLA 이내 |
| 2-cam TensorRT 환경, 29 이벤트 기준 | 최대 | 27ms | 29/29, 100%가 1초 SLA 이내 |

VLM 안정화는 수치보다 계약이다. 클립은 S3 GET 후 AI가 8프레임 메모리 비식별화 후 Gemini에 전달하며 키프레임 S3 PUT 8장 방식은 제거됐다. 백엔드는 POST internal vlm jobs와 service token으로 AI worker를 호출한다. 동일 MQTT eventId는 PostgreSQL advisory lock으로 중복 INSERT를 막는다. keyword 검색은 성공한 VLM 설명 LIKE이며 semantic 결과에 첫 스냅샷 presigned URL이 포함된다.

## 5. 한계

서로 다른 벤치 조건의 FPS와 지연을 한 표로 섞지 않는다. 원문은 ai-pipeline-stabilization-source.md이며 Wiki canonical은 본 허브와 child Evidence 페이지다.
