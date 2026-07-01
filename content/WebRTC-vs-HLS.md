---
title: WebRTC vs HLS
category: Frontend
relatedDocs: [ADR-001-WebRTC, Architecture, Bug-RTSP-Stream-404]
relatedFiles: [docs/webrtc_smoke.md, strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx]
updatedAt: 2026-06-26
---

## 목적

HLS 지연 문제와 WebRTC 도입 이유를 비교 지표 중심으로 정리한다.

## 배경

안전 관제 화면은 사고 상황을 몇 초 늦게 보는 것만으로도 대응 품질이 떨어진다. HLS는 안정적인 HTTP 기반 재생 장점이 있지만 segment와 buffering 구조 때문에 저지연 관제의 기본 경로로는 불리하다.

## 핵심 내용

| 항목 | HLS | WebRTC |
| --- | --- | --- |
| 지연 | segment 생성과 buffer로 수 초 지연 가능 | 1초 이하 목표에 적합 |
| MediaMTX path | `:8888/{cameraLoginId}/index.m3u8` | `:8889/{cameraLoginId}/whep` |
| 브라우저 처리 | hls.js 또는 native 지원 필요 | WebRTC API |
| 운영 역할 | fallback | primary live view |
| 성공 판정 | playlist/segment 응답과 video playing | WHEP 2xx, ICE connected, ontrack, framesDecoded 증가 |

## 입력

- MediaMTX RTSP stream
- HLS URL
- WebRTC WHEP URL
- Browser playback stats

## 출력

- WebRTC 우선 재생
- HLS fallback 재생
- fallback reason

## 동작 흐름

```text
Frontend selected cameraLoginId
-> try WHEP WebRTC playback
-> verify ICE/ontrack/stats/playing
-> fallback to HLS only on failure
```

## 관련 파일

- `docs/webrtc_smoke.md`
- `strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx`
- `strange_front/src/features/dashboard/data/cameras.ts`

## 관련 문서

- [ADR-001-WebRTC](ADR-001-WebRTC.md)
- [Architecture](Architecture.md)
- [Bug-RTSP-Stream-404](Bug-RTSP-Stream-404.md)

## 주의사항

WebRTC 도입은 AI → MQTT → Backend 이벤트 경로를 대체하지 않는다. 영상 전달 경로만 저지연으로 바꾸며, 안전 이벤트 계약은 그대로 유지한다.

## 후속 작업

카메라별 WebRTC health metric을 UI 또는 diagnostic log로 노출해, 단순 "화면 안 나옴"이 아니라 실패 reason을 구분한다.

---
#webrtc #hls #streaming #latency #mediamtx
