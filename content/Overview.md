---
title: Overview
category: Project
relatedDocs: [Architecture, AI-Pipeline, MQTT-Event-Schema]
relatedFiles: [README.md, PROJECT_CONTRACT.md, MULTI_AGENT_PLAN.md]
updatedAt: 2026-06-26
project: smart-safety-ai
type: overview
portfolio_use: true
---

## 목적

스마트 안전 관제 시스템은 CCTV 또는 RTSP 카메라 영상을 실시간으로 분석해 실신, 쓰러짐 같은 안전 이벤트를 감지하고 관제 화면과 알림 채널로 전달하는 프로젝트다.

이 Wiki의 목적은 사람 개발자뿐 아니라 Codex/LLM이 프로젝트 맥락을 빠르게 회복하도록 핵심 계약, 판단 근거, 버그 원인, 실험 결과를 구조화하는 것이다.

## 배경

프로젝트는 AI, Backend, Frontend, Infra가 nested repository 형태로 분리되어 있다. 각 파트의 실험 결과와 운영 판단이 문서, 대화, 코드에 흩어져 있어 신규 작업자가 전체 흐름을 한 번에 잡기 어렵다.

## 핵심 내용

- 개인 사용자: 개인용 카메라 등록, 실시간 영상 확인, 위험 이벤트 알림 확인이 중심이다.
- 기관 사용자: 다중 카메라 관제, 사고 이벤트 저장, 담당자 알림, 기록 관리가 중심이다.
- 공통 기준: 카메라 식별자는 `cameraLoginId`를 사용하고, 임의의 `cam1` 같은 임시 경로를 운영 표준으로 쓰지 않는다.

## 입력

- RTSP 카메라 스트림
- 샘플 영상 기반 RTSP publish
- AI 모델 checkpoint와 sequence 설정
- 카메라 등록 정보와 알림 설정

## 출력

- MQTT `safety/events` 이벤트
- Backend DB incident/event 기록
- WebSocket 실시간 알림
- Frontend 관제 대시보드 영상과 알림 UI

## 동작 흐름

```text
Camera or sample video
-> MediaMTX RTSP ingest
-> AI pose extraction and action classification
-> MQTT safety/events
-> Backend persistence and WebSocket broadcast
-> Frontend live monitoring and notification
```

## 관련 파일

- `README.md`
- `PROJECT_CONTRACT.md`
- `docs/AI_GUIDE.md`
- `docs/MQTT_TOPIC_SPEC.md`

## 관련 문서

- [Architecture](Architecture.md)
- [AI-Pipeline](AI-Pipeline.md)
- [MQTT-Event-Schema](MQTT-Event-Schema.md)

## 주의사항

민감정보, 실제 RTSP 계정, API key, 토큰은 문서에 포함하지 않는다. URL 예시는 계정 정보를 마스킹하거나 localhost 기반으로 작성한다.

## 후속 작업

실험 로그와 운영 장애 기록을 같은 frontmatter 형식으로 계속 추가해 검색 가능한 LLM 지식베이스로 확장한다.

---
#project #users #data-flow #llm-context
