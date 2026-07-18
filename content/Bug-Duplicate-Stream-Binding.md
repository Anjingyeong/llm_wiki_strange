---
title: 중복 streamUrl·overlayUrl 바인딩 감지
navTitle: "중복 스트림 바인딩"
shortTitle: "중복 스트림"
category: Bugs
tags: [front, mjpeg, streamUrl, overlayUrl, dashboard, debug]
relatedDocs:
  - Realtime-Camera-Runtime-Stabilization
  - Frame-Sync-Canonical
  - Develop-Code-Baseline-2026-07-15
relatedFiles:
  - strange_front/src/features/dashboard/hooks/useLiveCameras.ts
  - strange_front/src/features/dashboard/data/cameras.ts
  - strange_front/src/features/dashboard/components/CameraStreamFrame.tsx
updatedAt: 2026-07-15
type: incident
status: partial
evidenceLevel: unit-test
portfolio_use: true
prRefs:
  - strangeRookies/front#16
---

> **한 줄 결과:** 활성 카메라 목록을 `resolveCameraStream`으로 해석한 뒤, **동일 `streamUrl` 또는 `overlayUrl`이 두 카드 이상에 묶이면 DEV 콘솔에 경고**를 낸다. UI 자동 수정은 하지 않는다 — **설정·백엔드 overlay URL·폴백 로직**을 추적하기 위한 진단이다.

## Situation

- 대시보드 그리드/통합 화면에서 **서로 다른 `cameraLoginId`** 가 같은 MJPEG URL을 가리키면, 한 스트림이 여러 타일에 보이거나 잘못된 카메라 라벨이 붙을 수 있다.
- `IntegratedDashboard`는 `resolveCameraStream` 결과의 `streamUrl`을 카드에 넘긴다. 백엔드 `overlayUrl` 우선·`getDynamicStreamUrl` 폴백 조합이 꼬이면 중복이 생긴다.

## Task

- 런타임에서 **중복 바인딩을 조기에 알 수 있는** 저비용 가드.
- 운영 빌드에는 노이즈 없음 (DEV only).

## Action

`useLiveCameras`가 `fetchActiveCameras` 성공·폴백 경로 모두에서 `warnDuplicateStreamBindings` 호출:

1. `overlayUrl` 기준 Map — 2개 이상 loginId → `duplicate overlayUrl bound to multiple cards`
2. `streamUrl`(해석된 최종 URL) 기준 Map — 2개 이상 → `duplicate resolved streamUrl bound to multiple cards`

해석 규칙 (`cameras.ts`):

- MJPEG overlay가 브라우저 유효 URL이면 `overlayUrl` + kind `mjpeg`
- 아니면 `getDynamicStreamUrl(cameraLoginId)` (포트/경로 결정론적 매핑)

## Result

### 검증 완료

- 코드 리뷰: 경고는 `import.meta.env.DEV`에서만 실행.
- `verify-mjpeg-stream-routing.mjs`: 통합 대시보드가 `getDynamicStreamUrl` 사용 계약 유지.

### 미검증

- 실제 멀티 카메라 E2E에서 경고 발생 후 수동 수정 플로우.
- Proxy mode(`VITE_MJPEG_PROXY_MODE=true`)에서 URL 정규화 후 중복 검출.

## 동작 흐름

```text
fetchActiveCameras
  -> activeCameraToLiveCamera (resolveCameraStream per row)
  -> warnDuplicateStreamBindings (DEV)
  -> setCameras
```

## 관련 문서

- [Realtime-Camera-Runtime-Stabilization](Realtime-Camera-Runtime-Stabilization.md) — MJPEG 포트·경계 리셋
- [Develop-Code-Baseline-2026-07-15](Develop-Code-Baseline-2026-07-15.md) — develop vs draft 브랜치

## 후속

- PROD에서도 메트릭(카운터 1회)으로 승격 검토.
- 중복 시 UI 배지는 **미구현** (의도적 — 원인은 백엔드/할당).

---
#bug #front #mjpeg #streamUrl #dashboard
