---
title: MQTT Event Schema
category: Backend
tags: [mqtt, schema, event, backend-contract]
relatedDocs: [Architecture, AI-Pipeline]
relatedFiles: [PROJECT_CONTRACT.md, docs/MQTT_TOPIC_SPEC.md, strange_back/src/main/java/com/strange/safety/event]
updatedAt: 2026-06-26
---

# MQTT Event Schema

## 목적

AI가 발행하고 Backend가 구독하는 `safety/events` 계약을 LLM이 빠르게 확인할 수 있게 정리한다.

## 배경

Python AI는 snake_case 필드를 발행하고 Java Backend는 camelCase DTO를 사용한다. Backend는 alias 처리를 통해 양쪽 naming을 흡수해야 한다.

## 핵심 내용

- Topic: `safety/events`
- 발행자: AI worker
- 구독자: Spring Boot Backend
- 주요 식별자: `eventId`, `timestampMs`, `streamId`, `camera_login_id`
- 이벤트 배열: `events`

## 입력

AI inference 결과, track 정보, camera identifier, timestamp가 payload 생성 입력이다.

## 출력

```json
{
  "eventId": "cam_01:Faint:1780550000000:7",
  "timestampMs": 1780550000000,
  "streamId": "cam_01",
  "camera_login_id": "cam_01",
  "events": [
    {
      "type": "Faint",
      "severity": "HIGH",
      "confidence": 0.87,
      "track_id": 7,
      "bbox": [100, 150, 280, 390]
    }
  ]
}
```

## 동작 흐름

```text
AI event candidate
-> normalize camera_login_id and streamId
-> create deterministic eventId
-> publish safety/events
-> Backend maps DTO aliases
-> persist and broadcast
```

## 관련 파일

- `PROJECT_CONTRACT.md`
- `docs/MQTT_TOPIC_SPEC.md`
- `strange_back/src/main/java/com/strange/safety/event`

## 관련 문서

- [Architecture](Architecture.md)

## 주의사항

실제 payload는 과거 호환 필드인 `type`, `event_type`, `camera_id`, `detected_at`도 함께 포함할 수 있다. 신규 구현은 하위 호환성을 깨지 않도록 alias 전략을 유지해야 한다.

## 후속 작업

Backend DTO와 AI publisher의 실제 필드 목록을 통합 브랜치에서 스냅샷 테스트로 고정한다.
