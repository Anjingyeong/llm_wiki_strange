---
title: Glossary
navTitle: "용어집"
shortTitle: "용어집"
category: Glossary
relatedDocs: [Overview, Architecture, AI-Pipeline]
relatedFiles: [PROJECT_CONTRACT.md]
updatedAt: 2026-06-26
project: smart-safety-ai
type: reference
portfolio_use: true
implementationStatus: stable
verificationLevel: canonical
audience: [human, llm, codex]
---

## 목적

프로젝트에서 반복되는 약어와 기술 용어를 Codex/LLM이 같은 의미로 해석하도록 정리한다.

## 배경

스트리밍, AI, Backend, 알림 기술이 섞여 있어 같은 단어가 다른 층위에서 쓰일 수 있다. 용어 정의가 흔들리면 잘못된 파일을 수정하거나 계약을 오해하기 쉽다.

## 핵심 내용

| 용어 | 의미 |
| --- | --- |
| RTSP | 카메라 또는 sample video를 MediaMTX로 publish하는 실시간 스트리밍 프로토콜 |
| HLS | HTTP segment 기반 영상 재생 방식. fallback 경로로 적합하지만 지연이 큼 |
| WebRTC | 브라우저 저지연 실시간 재생 방식. MediaMTX WHEP endpoint로 연결 |
| MQTT | AI worker가 안전 이벤트를 publish하고 Backend가 subscribe하는 메시징 프로토콜 |
| LSTM | keypoint sequence를 받아 `Normal/Faint` 행동을 분류하는 시계열 모델 |
| YOLO | 사람 bbox와 pose keypoint를 추출하는 detector 계열 |
| ByteTrack | frame 간 동일 인물 track continuity를 유지하는 tracker |
| FCM | 모바일 push notification에 사용할 수 있는 Firebase Cloud Messaging |
| MediaMTX | RTSP ingest와 HLS/WebRTC playback endpoint를 제공하는 media server |
| cameraLoginId | 카메라 경로, Backend registry, Frontend stream URL, MQTT `streamId`를 묶는 표준 식별자 |
| FP | False Positive. 실제 Normal인데 Faint로 판단한 수 |
| FN | False Negative. 실제 Faint인데 놓친 수 |
| threshold | Faint probability를 이벤트 후보로 볼 기준값 |
| hard-negative | 모델이 Faint로 오판한 Normal sample. 오탐 감소 학습에 사용 |
| Event | 안전 이벤트 기본 단위. RTSP 프레임에서 YOLO/LSTM이 Faint로 분류하면 발생 |
| Alert | MQTT `safety/events`로 발행되어 Backend/Frontend에 전달되는 알림 |
| Incident | Backend에 영속화되는 사고 기록. Alert와 1:1 또는 다대일 매핑 |
| Notification | FCM/WebSocket 등 채널로 사용자에게 도달하는 최종 알림 |
| Faint class | LSTM 출력 라벨. Normal vs Faint 이진 분류 |
| Latest Frame Queue | RTSP 프레임 큐 정책. 오래된 프레임은 drop하고 최신만 유지하여 실시간성 보호 |
| E2E Alert Latency | AI 추론 시작부터 MQTT Subscriber 수신까지의 End-to-End 지연 (p50/p95) |
| p50 | 50 백분위수 지연 (중앙값) |
| p95 | 95 백분위수 지연. SLA 준수 지표로 주로 사용 |
| Hybrid RRF | Vector + BM25를 RRF(Reciprocal Rank Fusion)로 결합한 검색 전략 |
| BM25 | 키워드 기반 sparse 검색. Hybrid RRF의 lexical 컴포넌트 |
| insufficient_context | RAG가 근거 부족을 명시적으로 반환하는 상태. hallucination 방지 |
| clipObjectKey | VLM 스냅샷 S3 객체 키. eventId 기반 |
| Corpus Hash | 인덱스 생성 시 전체 문서 집합의 해시. staleness 검출에 사용 |
| Stale Index | Corpus Hash 불일치 또는 생성 시각이 오래된 인덱스 |
| Index | 검색/ RAG에 사용되는 구조화된 문서·청크 집합 |

## 입력

프로젝트 문서, 계약 파일, 코드 주석에서 반복되는 기술 용어가 입력이다.

## 출력

일관된 문서 용어와 LLM 검색 키워드.

## 동작 흐름

```text
new document or bug note
-> reuse Glossary terms
-> add alias only when needed
-> keep architecture and schema wording consistent
```

## 관련 파일

- `PROJECT_CONTRACT.md`
- `README.md`

## 관련 문서

- [Overview](Overview.md)
- [Architecture](Architecture.md)
- [AI-Pipeline](AI-Pipeline.md)

## 주의사항

`cameraLoginId`는 표시명이나 DB numeric id와 섞어 쓰지 않는다. RTSP/WebRTC/HLS/MQTT path를 잇는 운영 식별자다.

## 후속 작업

Backend DTO, Frontend props, AI payload에서 같은 개념의 이름 차이를 alias 표로 확장한다.

---
#glossary #terms #llm-context
