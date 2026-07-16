---
title: MQTT End-to-End Alert Latency Evidence
navTitle: MQTT E2E 지연
shortTitle: MQTT E2E
category: Evidence
tags: [portfolio, evidence, mqtt, latency, e2e, tensorrt, alert]
relatedDocs:
  - Benchmark-Evidence-Hub
  - ED-MQTT-Backend-Event-Path
  - MQTT-Event-Schema
  - Evidence-RTSP-2Cam-Queue-TensorRT
  - AI-Pipeline
relatedFiles:
  - ai-pipeline-stabilization-source.md
updatedAt: 2026-07-16
project: smart-safety-ai
type: evidence
portfolio_use: true
evidence_type: benchmark
---

> **RAG 한 줄:** 2-cam TensorRT에서 AI 프레임 수신부터 MQTT Subscriber까지 E2E p95 26ms, 29건 전부 1초 이내.

## 1. 문제 정의

실시간 Faint 알림은 관제 SLA(1초 이내 전달)를 만족해야 한다. AI 추론·발행 대기·브로커·구독 구간을 합친 End-to-End Alert Latency를 Evidence로 고정해야 TensorRT·큐 변경의 운영 영향을 설명할 수 있다.

## 4. 구현 및 검증

| 측정 지표 | 결과 | 조건 |
| --- | ---: | --- |
| 측정 이벤트 수 | 29 | cam_03 + cam_04, TensorRT |
| AI 처리 평균 | 8.586ms | p95 12ms |
| 처리 완료 → MQTT 발행 p95 | 15.6ms | 평균 11.759ms |
| MQTT 전송 p95 | 1ms | 평균 0.586ms |
| **E2E 평균** | **20.931ms** | |
| E2E p50 | 21ms | |
| **E2E p95** | **26ms** | |
| E2E 최대 | 27ms | |
| 1초 SLA 이내 | **100%** | 29/29 |

RAG 검색용 평문: MQTT 알림 End-to-End 지연은 평균 20.931ms이고 p95는 26ms이며 최대 27ms이다. 29개 이벤트 모두 1초 이내 Subscriber 도달을 만족했다.

## 5. 한계

단일 환경 스냅샷. 이벤트 건수는 live 구간 차이로 backend 정확도 비교 지표에서 제외(원문). 재측정 시 [Benchmark-Evidence-Hub](Benchmark-Evidence-Hub.md) §3.5와 정합 유지.