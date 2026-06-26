---
title: ADR-001 WebRTC
category: ADR
tags: [adr, webrtc, hls, streaming-decision]
relatedDocs: [WebRTC-vs-HLS, Architecture]
relatedFiles: [docs/webrtc_smoke.md, docker-compose.webrtc-smoke.yml]
updatedAt: 2026-06-26
---

# ADR-001 WebRTC

## 목적

HLS 대신 WebRTC를 주 재생 경로로 선택한 이유를 의사결정 기록으로 남긴다.

## 배경

안전 관제 시스템의 영상은 단순 재생 콘텐츠가 아니라 사고 판단과 즉시 대응을 위한 운영 화면이다. HLS 지연은 시스템이 정상 작동해도 사용자가 늦게 반응하게 만드는 구조적 한계가 있다.

## 핵심 내용

Decision: Frontend live camera playback의 기본 경로는 WebRTC WHEP로 두고, HLS는 fallback으로 유지한다.

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
try WHEP
-> validate media stats
-> continue WebRTC
-> fallback to HLS on timeout/freeze/error
```

## 관련 파일

- `docs/webrtc_smoke.md`
- `docker-compose.webrtc-smoke.yml`

## 관련 문서

- [WebRTC-vs-HLS](WebRTC-vs-HLS.md)

## 주의사항

WebRTC 도입은 AI, MQTT, Backend event path를 대체하지 않는다. 영상 전달 경로만 바꾸며 안전 이벤트 계약은 그대로 유지한다.

## 후속 작업

WebRTC 장애 유형별 retry 정책과 HLS fallback 종료 조건을 ADR 후속 문서로 분리한다.
