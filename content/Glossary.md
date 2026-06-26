---
title: Glossary
category: Glossary
tags: [glossary, terms, llm-context]
relatedDocs: [Overview, Architecture]
relatedFiles: [PROJECT_CONTRACT.md]
updatedAt: 2026-06-26
---

# Glossary

## 목적

프로젝트에서 반복되는 약어와 기술 용어를 Codex/LLM이 같은 의미로 해석하도록 정리한다.

## 배경

스트리밍, AI, Backend, 알림 기술이 섞여 있어 같은 단어가 다른 층위에서 쓰일 수 있다. 용어 정의가 흔들리면 잘못된 파일을 수정하거나 계약을 오해하기 쉽다.

## 핵심 내용

| 용어 | 의미 |
| --- | --- |
| RTSP | 카메라 또는 sample video를 MediaMTX로 publish하는 실시간 스트리밍 프로토콜 |
| HLS | HTTP segment 기반 영상 재생 방식. fallback 경로로 적합하지만 지연이 큼 |
| WebRTC | 브라우저 저지연 실시간 재생 방식. WHEP endpoint로 연결 |
| MQTT | AI worker가 안전 이벤트를 publish하고 Backend가 subscribe하는 메시징 프로토콜 |
| LSTM | keypoint sequence를 받아 Normal/Faint 행동을 분류하는 시계열 모델 |
| YOLO | 사람 bbox와 pose keypoint를 추출하는 detector 계열 |
| ByteTrack | frame 간 동일 인물 track continuity를 유지하는 tracker |
| FCM | 모바일 push notification에 사용할 수 있는 Firebase Cloud Messaging |
| MediaMTX | RTSP ingest와 HLS/WebRTC playback endpoint를 제공하는 media server |

## 입력

프로젝트 문서, 계약 파일, 코드 주석에서 반복되는 기술 용어가 입력이다.

## 출력

일관된 문서 용어와 LLM 검색 키워드.

## 동작 흐름

새 문서 작성 시 이 용어를 우선 사용하고, 다른 이름이 필요하면 Glossary에 alias를 추가한다.

## 관련 파일

- `PROJECT_CONTRACT.md`
- `README.md`

## 관련 문서

- [Overview](Overview.md)
- [Architecture](Architecture.md)

## 주의사항

`cameraLoginId`는 카메라 경로와 Backend mapping의 표준 식별자다. 단순 표시명이나 DB numeric id와 섞어 쓰지 않는다.

## 후속 작업

Backend DTO, Frontend props, AI payload에서 같은 개념의 이름 차이를 alias 표로 확장한다.
