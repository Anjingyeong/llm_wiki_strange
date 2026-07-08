---
title: ADR-002 MQTT Metadata Separation
navTitle: ADR-002
shortTitle: ADR-002
category: ADR
relatedDocs: [MQTT-Event-Schema, AI-Output-JSON, Bug-Notification-Scope]
relatedFiles: [PROJECT_CONTRACT.md, strange_back/src/main/java/com/strange/safety/alert/service/AlertEventService.java]
updatedAt: 2026-06-26
---

## 목적

MQTT payload에는 AI 판단에 필요한 event metadata만 담고, 사용자/기관 권한과 알림 scope는 Backend에서 resolve하도록 결정한다.

## 배경

AI worker는 영상을 보고 이벤트 후보를 만든다. 하지만 개인 사용자와 기관 사용자의 권한, 알림 수신 대상, camera ownership은 Backend DB의 책임이다. AI payload에 사용자 정보를 직접 넣으면 privacy와 권한 경계가 흐려진다.

## 핵심 내용

Decision:

- MQTT event에는 `eventId`, `timestampMs`, `streamId`, `camera_login_id`, frame size, event candidates만 담는다.
- 사용자 ID, 기관 ID, 권한 scope는 Backend가 `cameraLoginId`로 camera registry를 조회해 결정한다.
- 원본 RTSP URL, 비밀번호, 토큰은 MQTT에 넣지 않는다.

## 입력

- AI output JSON
- Backend camera registry
- 개인/기관 카메라 테이블
- WebSocket notification policy

## 출력

- 저장 가능한 안전 이벤트
- scope가 분리된 사용자 알림
- 민감정보 없는 event payload

## 동작 흐름

```text
AI publishes cameraLoginId
-> Backend receives MQTT event
-> Backend resolves camera ownership/scope
-> Backend stores incident
-> Backend broadcasts only to allowed subscribers
```

## 관련 파일

- `PROJECT_CONTRACT.md`
- `strange_back/src/main/java/com/strange/safety/alert/service/AlertEventService.java`

## 관련 문서

- [MQTT-Event-Schema](MQTT-Event-Schema.md)
- [AI-Output-JSON](AI-Output-JSON.md)
- [Bug-Notification-Scope](Bug-Notification-Scope.md)

## 주의사항

AI가 `streamId`를 잘못 보내면 Backend scope resolve도 잘못될 수 있다. metadata separation은 path 일치 검증과 함께 적용해야 한다.

## 후속 작업

Backend에 개인/기관 camera resolve 테스트와 WebSocket topic scope 테스트를 추가한다.

---
#adr #mqtt #metadata #privacy #backend-contract
