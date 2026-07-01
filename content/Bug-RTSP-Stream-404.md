---
title: Bug RTSP Stream 404
category: Bugs
relatedDocs: [Architecture, WebRTC-vs-HLS, AI-Output-JSON]
relatedFiles: [PROJECT_CONTRACT.md, strange_ai/.env.example, strange_front/src/features/dashboard/data/cameras.ts]
updatedAt: 2026-06-26
---

## 목적

MediaMTX stream path와 `cameraLoginId`가 어긋날 때 WebRTC/HLS 경로에서 404가 발생하는 문제를 기록한다.

## 배경

운영 표준 경로는 `rtsp://<host>:8554/{cameraLoginId}`이다. AI, Backend, Frontend가 서로 다른 임시 ID를 사용하면 같은 카메라를 가리키는 것처럼 보여도 실제 MediaMTX path는 달라진다.

## 핵심 내용

대표적인 실패 패턴:

- AI는 `rtsp://localhost:8554/cam1`로 publish한다.
- Backend/Frontend는 `cam_01`을 cameraLoginId로 사용한다.
- Frontend는 `http://localhost:8889/cam_01/whep` 또는 `http://localhost:8888/cam_01/index.m3u8`를 요청한다.
- MediaMTX에는 `cam_01` stream이 없어서 404가 발생한다.

정상 기준:

```text
cameraLoginId = cam_01
RTSP publish  = rtsp://localhost:8554/cam_01
WebRTC WHEP   = http://localhost:8889/cam_01/whep
HLS fallback  = http://localhost:8888/cam_01/index.m3u8
MQTT streamId = cam_01
```

## 입력

- Backend camera registry의 `cameraLoginId`
- AI worker RTSP publish path
- Frontend stream URL 생성 함수
- MediaMTX active path

## 출력

- 404 없는 WebRTC/HLS 재생
- MQTT 이벤트와 화면 카메라의 동일한 식별자 매핑

## 동작 흐름

```text
register cameraLoginId
-> publish RTSP with same path
-> MediaMTX exposes HLS/WHEP path
-> Frontend builds stream URL from cameraLoginId
-> AI publishes MQTT streamId with same value
```

## 관련 파일

- `PROJECT_CONTRACT.md`
- `strange_ai/.env.example`
- `strange_front/src/features/dashboard/data/cameras.ts`

## 관련 문서

- [Architecture](Architecture.md)
- [WebRTC-vs-HLS](WebRTC-vs-HLS.md)

## 주의사항

404를 player fallback만으로 숨기면 이벤트와 영상의 camera mapping 오류가 남는다. path 불일치를 먼저 고쳐야 한다.

## 후속 작업

통합 smoke test에서 `cameraLoginId`, RTSP path, WHEP path, MQTT `streamId`를 같은 값으로 검증한다.

---
#bug #rtsp #mediamtx #camera-login-id #stream-404
