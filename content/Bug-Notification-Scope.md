---
title: Bug Notification Scope
navTitle: "알림 범위"
shortTitle: "알림 범위"
category: Bugs
relatedDocs: [MQTT-Event-Schema, Architecture, ADR-002-MQTT-Metadata-Separation]
relatedFiles: [strange_back/src/main/java/com/strange/safety/alert/service/AlertEventService.java, strange_front/src/features/dashboard]
updatedAt: 2026-06-26
---

## 목적

개인용 카메라만 등록했는데 기업용 알림이 발생한 문제의 원인 가설과 해결 방향을 기록한다.

## 배경

이 문제는 AI 모델이 `Faint`를 잘못 판단했는지와 별개다. 모델이 이벤트를 발행하더라도 Backend와 Frontend가 사용자 scope를 올바르게 분리해야 개인용/기관용 알림이 섞이지 않는다.

## 핵심 내용

가능한 원인 가설:

| Hypothesis | 설명 | 확인 포인트 |
| --- | --- | --- |
| Backend scope resolve 누락 | MQTT 이벤트 저장 시 개인/기관 camera ownership을 분리하지 않음 | `cameraLoginId`로 개인/기관 repository 조회 |
| WebSocket topic 과도한 공유 | 사용자별 topic이 아니라 전역 topic으로 모두 broadcast | subscribe topic과 principal filter |
| MQTT metadata 부족 | `streamId`는 있지만 Backend가 owner를 찾지 못해 fallback camera를 사용 | fallback `"cam_01"` 같은 기본값 존재 여부 |
| Frontend merge 오류 | 개인/기관 alert list를 화면에서 같은 collection으로 표시 | dashboard alert mapping |

## 입력

- 개인 사용자 카메라 등록 정보
- 기관 카메라 등록 정보
- AI MQTT 이벤트
- Backend incident persistence
- Frontend notification subscription

## 출력

- 잘못된 기업용 알림
- 사용자 범위를 벗어난 incident 노출

## 동작 흐름

```text
MQTT event streamId
-> Backend resolves cameraLoginId
-> determine personal or corporate scope
-> persist scoped event
-> broadcast only to allowed subscriber
```

## 관련 파일

- `strange_back/src/main/java/com/strange/safety/alert/service/AlertEventService.java`
- `strange_front/src/features/dashboard`

## 관련 문서

- [MQTT-Event-Schema](MQTT-Event-Schema.md)
- [ADR-002-MQTT-Metadata-Separation](ADR-002-MQTT-Metadata-Separation.md)
- [Architecture](Architecture.md)

## 주의사항

AI payload에 사용자 식별자를 직접 넣는 방식은 피한다. 권한과 소유권은 Backend DB의 camera registry를 기준으로 resolve하는 편이 안전하다.

## 후속 작업

개인 카메라 이벤트가 기관 WebSocket 구독자에게 전달되지 않는 테스트와, 기관 이벤트가 개인 사용자 알림에 섞이지 않는 테스트를 추가한다.

---
#bug #notification #personal-camera #enterprise-alert #scope
