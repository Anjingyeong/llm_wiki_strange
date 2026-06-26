---
title: ADR-001 WebRTC
category: ADR
tags: [adr, webrtc, hls, streaming-decision]
relatedDocs: [WebRTC-vs-HLS, Architecture, Bug-RTSP-Stream-404]
relatedFiles: [docs/webrtc_smoke.md, docker-compose.webrtc-smoke.yml]
updatedAt: 2026-06-26
---

# ADR-001 WebRTC

## 목적

HLS 대신 WebRTC를 관제 화면의 기본 실시간 재생 경로로 선택한 이유를 기록한다.

## 배경

안전 관제 시스템의 영상은 단순 재생 콘텐츠가 아니라 사고 판단과 즉시 대응을 위한 운영 화면이다. HLS 지연은 시스템이 정상 작동해도 사용자가 늦게 반응하게 만드는 구조적 한계가 있다.

## 핵심 내용

Decision:

- Frontend live camera playback의 기본 경로는 MediaMTX WebRTC WHEP로 둔다.
- HLS는 fallback으로 유지한다.
- path는 `cameraLoginId`를 기준으로 통일한다.

근거:

- HLS는 segment와 player buffer 때문에 저지연 목표에 불리하다.
- WebRTC는 MediaMTX WHEP 경로로 브라우저 재생이 가능하다.
- smoke 기준은 WHEP 2xx, ICE connected/completed, ontrack, bytesReceived 증가, framesDecoded 증가, playing event다.
- fallback을 유지하면 WebRTC 장애 시 운영 화면이 완전히 비지 않는다.

## 입력

- MediaMTX WebRTC WHEP endpoint
- Browser WebRTC stats
- HLS fallback URL

## 출력

- WebRTC 우선 재생
- 실패 시 HLS 예비 재생
- 연결 실패 reason

## 동작 흐름

```text
cameraLoginId
-> http://<host>:8889/{cameraLoginId}/whep
-> WebRTC negotiation
-> video playing
-> fallback to HLS only when needed
```

## 관련 파일

- `docs/webrtc_smoke.md`
- `docker-compose.webrtc-smoke.yml`
- `strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx`

## 관련 문서

- [WebRTC-vs-HLS](WebRTC-vs-HLS.md)
- [Architecture](Architecture.md)
- [Bug-RTSP-Stream-404](Bug-RTSP-Stream-404.md)

## 주의사항

WebRTC path가 404라면 player 문제가 아니라 MediaMTX path와 `cameraLoginId` 불일치일 가능성이 높다.

## 후속 작업

WebRTC 장애 유형별 retry 정책과 HLS fallback 종료 조건을 후속 ADR로 분리한다.
