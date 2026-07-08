---
title: WebRTC vs HLS
category: Frontend
relatedDocs: [ADR-001-WebRTC, Architecture, Bug-RTSP-Stream-404, mjpeg-display-rollback]
relatedFiles: [docs/webrtc_smoke.md, strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx]
updatedAt: 2026-07-08
---

## 목적

HLS 지연 문제와 WebRTC 도입 이유를 비교 지표 중심으로 정리한다.

## 배경

안전 관제 화면은 사고 상황을 몇 초 늦게 보는 것만으로도 대응 품질이 떨어진다. HLS는 안정적인 HTTP 기반 재생 장점이 있지만 segment와 buffering 구조 때문에 저지연 관제의 기본 경로로는 불리하다. 초저지연을 위해 WebRTC가 도입되었으나, 실제 개발/시연 환경의 네트워크 불안정성 및 MediaMTX 라이프사이클 이슈로 인해 **2026-07-08일자로 브라우저 기본 전송 방식은 MJPEG로 원복하고 WebRTC/HLS는 예비/fallback 모드로 분리**하였다.

## 핵심 내용

| 항목 | HLS | WebRTC | MJPEG (기본값) |
| --- | --- | --- | --- |
| 지연 | segment 생성과 buffer로 수 초 지연 가능 | 1초 이하 목표에 적합 | 100~300ms 저지연 렌더링 |
| MediaMTX path | `:8888/{cameraLoginId}/index.m3u8` | `:8889/{cameraLoginId}/whep` | N/A (Worker 직접 바인딩) |
| 브라우저 처리 | hls.js 또는 native 지원 필요 | WebRTC API | `<img>` 태그로 즉시 렌더링 |
| 운영 역할 | fallback | fallback / 장기 재검토 | primary live view |
| 성공 판정 | playlist/segment 응답 | WHEP 2xx, ICE connected | Multipart HTTP 200 OK 수신 |

## 입력

- MediaMTX RTSP stream
- HLS URL
- WebRTC WHEP URL
- MJPEG Stream URL (`VITE_MJPEG_BASE_URL`)
- Browser playback stats

## 출력

- MJPEG 우선 재생
- WebRTC / HLS fallback 재생
- fallback reason

## 동작 흐름

```text
Frontend selected cameraLoginId
-> try MJPEG rendering (http://localhost:<computedPort>/mjpeg/{cameraLoginId})
-> fallback to WebRTC/HLS only on explicit mode change
```

## 관련 파일

- `docs/webrtc_smoke.md`
- `strange_front/src/features/dashboard/components/WebRtcCameraPlayer.tsx`
- `strange_front/src/features/dashboard/data/cameras.ts`

## 관련 문서

- [MJPEG Display Rollback Decision](mjpeg-display-rollback.md)
- [ADR-001-WebRTC](ADR-001-WebRTC.md)
- [Architecture](Architecture.md)
- [Bug-RTSP-Stream-404](Bug-RTSP-Stream-404.md)

## 주의사항

WebRTC 및 MJPEG 도입은 AI → MQTT → Backend 이벤트 경로를 대체하지 않는다. 영상 전달 경로만 안정화된 display transport로 바꾸며, 안전 이벤트 계약은 그대로 유지한다.

## 후속 작업

카메라별 WebRTC health metric 및 MJPEG stream의 생존 상태(stale check)를 모니터링하여 실패 reason을 정확히 구분한다.

---
#webrtc #hls #streaming #latency #mediamtx
