---
title: Two-Camera RTSP Queue and TensorRT Latency Evidence
navTitle: 2채널 RTSP·큐·TensorRT 지연 검증
shortTitle: 2-cam RTSP
category: Evidence
category: Evidence
tags: [portfolio, evidence, rtsp, tensorrt, queue, latest-frame, multi-camera]
relatedDocs:
  - Benchmark-Evidence-Hub
  - Evidence-TensorRT-Adoption-Decision
  - Realtime-Camera-Runtime-Stabilization
  - AI-Pipeline
relatedFiles:
  - ai-pipeline-stabilization-source.md
updatedAt: 2026-07-16
project: smart-safety-ai
type: evidence
status: partial
evidenceLevel: offline-benchmark
portfolio_use: true
evidence_type: benchmark
---

> **RAG 한 줄:** cam_03+cam_04, queue=3 — YOLO 약 50%↓, aggregate FPS ~28.7 유사(RTSP ~14.5 FPS/cam 상한).

## 4. 구현 및 검증

| 지표 | PyTorch | TensorRT | 변화 | 조건 |
| --- | ---: | ---: | --- | --- |
| YOLO 평균 지연 | 9.454ms | 4.723ms | −50.04% | 2-cam RTSP |
| 최악 카메라 YOLO p95 | 14.719ms | 7.159ms | −51.36% | |
| 전체 프레임 평균 처리 | 11.789ms | 6.101ms | −48.25% | |
| Dropped frames | 40 | 34 | −6 | Latest Frame queue=3 |
| Aggregate FPS | 28.701 | 28.339 | 유사 | 3600f total |

RAG 검색용 평문: 두 대 RTSP cam_03 cam_04 동시 처리에서 Latest Frame queue 크기 3 정책을 쓰면 TensorRT가 YOLO 평균 지연을 9.454ms에서 4.723ms로 줄이지만 aggregate FPS는 28.701과 28.339로 거의 같다. RTSP 카메라당 약 14.5 FPS 공급이 처리량 상한이다.

## 5. 한계

3000f offline TensorRT FPS(약 196)와 혼동 금지 — [Benchmark-Evidence-Hub](Benchmark-Evidence-Hub.md).
