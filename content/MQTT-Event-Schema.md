---
title: MQTT Event Schema
navTitle: MQTT Schema
shortTitle: MQTT Schema
category: Backend
relatedDocs: [Architecture, AI-Pipeline, AI-Output-JSON, ADR-002-MQTT-Metadata-Separation, Graphify-Semantic-Map]
relatedFiles: [PROJECT_CONTRACT.md, docs/MQTT_TOPIC_SPEC.md, strange_ai/messaging/event_schema.py, strange_back/src/main/java/com/strange/safety/event/MqttSafetyEventSubscriber.java, strange_back/src/main/java/com/strange/safety/event/AlertBroadcastService.java, strange_back/src/main/java/com/strange/safety/event/SafetyEventDto.java, strange_back/src/main/java/com/strange/safety/alert/service/AlertEventService.java]
updatedAt: 2026-07-15
---

## 목적

AI가 발행하고 Backend가 구독하는 `safety/events` 계약을 LLM이 빠르게 확인할 수 있게 정리한다.

## 배경

Python AI는 frame/track 기반 이벤트 후보를 만들고, Spring Boot Backend는 이를 저장한 뒤 DB/WebSocket/알림 흐름으로 연결한다. payload는 AI 판단 metadata를 담되 사용자 권한과 기관/개인 scope는 Backend camera registry에서 resolve한다.

## 핵심 내용

- Topic: `safety/events`
- 발행자: AI worker
- 구독자: Spring Boot Backend
- 필수 식별자: `eventId`, `timestampMs`, `streamId`
- 권장 호환 필드: `camera_login_id`
- 이벤트 배열: `events`
- 민감정보 금지: 원본 RTSP 계정, 비밀번호, API token

## 입력

- AI inference 결과
- track id와 bbox
- `cameraLoginId`와 일치하는 `streamId`
- timestamp와 frame size

## 출력

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt-20260623-cam_01-000001",
  "timestampMs": 1782180000123,
  "streamId": "cam_01",
  "frameWidth": 640,
  "frameHeight": 360,
  "events": [
    {
      "type": "faint",
      "confidence": 0.87,
      "bbox": [120, 80, 260, 360],
      "trackId": 3,
      "memoText": "실신 의심"
    }
  ]
}
```

호환 필드가 필요한 경우:

```json
{
  "camera_login_id": "cam_01",
  "camera_id": "cam_01",
  "event_type": "faint",
  "detected_at": "2026-06-23T10:00:00Z"
}
```

## 동작 흐름

```text
AI event candidate
-> normalize streamId and camera_login_id
-> create deterministic eventId
-> publish safety/events
-> Backend maps aliases
-> Backend resolves camera scope
-> persist and broadcast
```

## 관련 파일

- `PROJECT_CONTRACT.md`
- `docs/MQTT_TOPIC_SPEC.md`
- `strange_ai/messaging/event_schema.py` — `build_safety_event` (발행 측 스키마)
- `strange_back/src/main/java/com/strange/safety/event/MqttSafetyEventSubscriber.java` — `safety/events` 구독
- `strange_back/src/main/java/com/strange/safety/event/AlertBroadcastService.java`
- `strange_back/src/main/java/com/strange/safety/event/SafetyEventDto.java`
- `strange_back/src/main/java/com/strange/safety/alert/service/AlertEventService.java` — 영속화·조회 (전체 backend)

## 관련 문서

- [Architecture](Architecture.md)
- [AI-Pipeline](AI-Pipeline.md)
- [AI-Output-JSON](AI-Output-JSON.md)
- [ADR-002-MQTT-Metadata-Separation](ADR-002-MQTT-Metadata-Separation.md)
- [Graphify-Semantic-Map](Graphify-Semantic-Map.md)

## 주의사항

AI payload는 사용자/기관 권한을 직접 결정하지 않는다. Backend가 `cameraLoginId`로 개인용/기관용 카메라를 resolve하고, 허용된 구독자에게만 WebSocket/알림을 보내야 한다.

## 후속 작업

Backend DTO와 AI publisher의 실제 필드 목록을 통합 브랜치에서 스냅샷 테스트로 고정한다.

---
#mqtt #schema #event #backend-contract #json
