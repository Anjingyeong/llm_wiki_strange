---
title: Bug Notification Scope
category: Bugs
tags: [bug, notification, personal-camera, enterprise-alert]
relatedDocs: [MQTT-Event-Schema, Architecture]
relatedFiles: [strange_back/src, strange_front/src/features/dashboard]
updatedAt: 2026-06-26
---

# Bug Notification Scope

## 목적

개인용 카메라만 등록했는데 기업용 알림이 발생한 문제의 원인 가설과 해결 방향을 기록한다.

## 배경

사용자 scope와 camera ownership이 분리되어 있으면 한 사용자의 이벤트가 다른 사용자 또는 기관 알림 영역에 노출될 수 있다. 이 문제는 모델 정확도 문제가 아니라 이벤트 라우팅과 권한 필터링 문제로 봐야 한다.

## 핵심 내용

가능한 원인 가설:

- Backend 이벤트 저장 시 camera owner 또는 tenant scope를 함께 기록하지 않음
- Frontend WebSocket 구독이 사용자별 topic이 아니라 전역 topic만 사용함
- MQTT payload에 `streamId` 또는 `camera_login_id`는 있지만 account context가 없음
- 테스트 데이터의 카메라 ID가 개인/기업 경계를 구분하지 못함

## 입력

- 개인 사용자 카메라 등록 정보
- AI MQTT 이벤트
- Backend incident persistence
- Frontend notification subscription

## 출력

- 잘못된 기업용 알림
- 사용자 범위를 벗어난 incident 노출

## 동작 흐름

```text
personal camera event
-> MQTT safety/events
-> Backend maps camera_login_id
-> missing or wrong ownership filter
-> global notification broadcast
-> enterprise alert UI receives event
```

## 관련 파일

- `strange_back/src/main/java/com/strange/safety/event`
- `strange_front/src/features/dashboard`

## 관련 문서

- [MQTT-Event-Schema](MQTT-Event-Schema.md)

## 주의사항

AI 이벤트 payload에 사용자 식별자를 직접 넣는 방식은 신중해야 한다. 권한과 소유권은 Backend의 camera registry를 기준으로 resolve하는 편이 안전하다.

## 후속 작업

Backend에서 `cameraLoginId -> owner/tenant/scope` resolve 후 저장과 WebSocket publish를 scope별로 제한하는 테스트를 추가한다.
