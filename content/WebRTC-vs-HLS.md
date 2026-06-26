---
title: WebRTC vs HLS
category: Frontend
tags: [webrtc, hls, streaming, latency, mediamtx]
relatedDocs: [ADR-001-WebRTC, Architecture]
relatedFiles: [docs/webrtc_smoke.md, strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx]
updatedAt: 2026-06-26
---

# WebRTC vs HLS

## 목적

HLS 지연 문제와 WebRTC 도입 이유를 비교 지표 중심으로 정리한다.

## 배경

안전 관제 화면은 사고 상황을 몇 초 늦게 보는 것만으로도 사용자 경험과 운영 신뢰도가 떨어진다. HLS는 안정적인 HTTP 기반 재생 장점이 있지만 segment와 buffering 구조 때문에 저지연 관제에 불리하다.

## 핵심 내용

| 항목 | HLS | WebRTC |
| --- | --- | --- |
| 지연 | segment 생성과 buffer로 수 초 지연 가능 | 1초 이하 목표에 적합 |
| 브라우저 지원 | hls.js 또는 native 지원 필요 | WebRTC API 사용 |
| 장애 대응 | fallback으로 적합 | 주 재생 경로 후보 |
| MediaMTX 경로 | `:8888/{cameraLoginId}/index.m3u8` | `:8889/{cameraLoginId}/whep` |

## 입력

- MediaMTX RTSP stream
- HLS URL
- WebRTC WHEP URL
- Browser playback metrics

## 출력

- `playing` event
- `framesDecoded`
- `bytesReceived`
- fallback reason

## 동작 흐름

```text
Frontend camera card
-> try WebRTC WHEP
-> monitor ICE, track, framesDecoded
-> keep WebRTC if healthy
-> fallback to HLS if connection fails or freezes
```

## 관련 파일

- `docs/webrtc_smoke.md`
- `strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx`

## 관련 문서

- [ADR-001-WebRTC](ADR-001-WebRTC.md)
- [Architecture](Architecture.md)

## 주의사항

WebRTC smoke test는 WHEP HTTP 응답만으로 성공이라고 보지 않는다. ICE connected, ontrack, bytesReceived, framesDecoded, video playing까지 확인해야 한다.

## 후속 작업

관제 화면에서 카메라별 WebRTC health metric을 UI 또는 diagnostic log로 노출한다.
