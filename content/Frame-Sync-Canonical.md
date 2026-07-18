---
title: "AI Metadata와 영상 프레임을 frameId로 동기화한 방법"
navTitle: "frameId 동기화"
shortTitle: "Frame Sync"
category: Architecture
type: experiment
status: partial
evidenceLevel: unit-test
canonicalFor: frame-overlay-sync
relatedDocs:
  - ED-FrameId-Evidence-Overlay-Sync
  - Frame-Matching-Report
  - Frame-Sync-Debug-Report
  - Multi-Camera-Frame-Latency-Report
  - ED-Latest-Frame-Queue-Policy
  - Plan-WebRTC-DataChannel-Sync
  - Multi-Camera-Worker-Session-Reliability
relatedFiles:
  - strange_ai/ai/frame_sync.py
  - strange_ai/ai/evidence.py
  - strange_front/src/shared/utils/overlaySync.ts
  - strange_front/scripts/verify-overlay-sync-contract.mjs
updatedAt: 2026-07-15
portfolio_use: true
---

> **한 줄 결과:** 다중 카메라에서도 **frameId 우선 + streamRunId/evidence 키**로 Overlay를 맞추고, AI 쪽은 **bounded queue·frame_sync 메타**로 지연 누적을 줄였다. **계약·단위/contract 테스트는 통과**했으나 **브라우저 다중 카메라 E2E frame-perfect 수치는 부분·미검증**이다.

## 현재 상태

| 항목 | 값 |
|------|-----|
| `canonicalFor` | frame-overlay-sync |
| `status` | **partial** |
| 검증 완료 | overlay-sync contract/behavior tests, AI `frame_sync`·payload schema |
| 부분 검증 | 단일 채널·MJPEG 표시 경로에서 운영 관측 |
| 미검증 | WebRTC 재생 시 화면 frameId와 MQTT frameId 1:1, 다중 카메라 장시간 E2E |

## Situation

- 영상 경로(WebRTC/MJPEG/HLS)와 메타데이터 경로(MQTT → Backend → STOMP)가 **물리적으로 분리**되어 Overlay가 다른 시각의 장면에 그려질 수 있다.
- receive time만으로 맞추면 클럭·버퍼·인코딩 지연이 겹친다.
- 다중 카메라에서 버퍼를 공유하면 `cameraLoginId`별 매칭이 꼬인다.
- Backend DTO가 동기화 필드를 떨어뜨리면 프론트에 `frameId`/`capturedAtMs`가 도달하지 않는다.

## Task

- 동일 Evidence Frame을 재현할 수 있는 **식별자 계약** 정의.
- RTSP 백로그로 인한 **수 초 지연** 완화.
- 지연(Frame stale)과 **매칭 오차**를 구분해 관측 가능하게 할 것.

## Action

### Decision (왜 frameId인가)

- [ED-FrameId-Evidence-Overlay-Sync](ED-FrameId-Evidence-Overlay-Sync.md): timestamp만 주 경로로 쓰지 않고 **frameId 우선**, 스트림 재시작 충돌은 `streamRunId`·`evidence_frame_key`로 완화.

### AI 엔진

- `FrameMetadataBuffer` (`frame_sync.py`): `frameId`, `capturedAtMs`, `processedAtMs`, `publishedAtMs`, 지연 지표.
- 멀티스레드 + **bounded `CameraFrameQueue` (drop-old)** — [Multi-Camera-Frame-Latency-Report](Multi-Camera-Frame-Latency-Report.md), [ED-Latest-Frame-Queue-Policy](ED-Latest-Frame-Queue-Policy.md).
- 가벼운 **`frame_sync` MQTT**와 overlay payload에 동일 필드 포함 — [Frame-Sync-Debug-Report](Frame-Sync-Debug-Report.md) § Payload.

### Backend

- Overlay DTO에 동기화 필드 수용, `frame_sync` 즉시 브로드캐스트(overlay 스냅샷 덮어쓰기 방지).

### Frontend

- `cameraLoginId`별 `OverlaySyncBuffer` / `FrameSyncBuffer`.
- `select`: **1) nearestByFrameId → 2) capturedAtMs → 3) receivedAtMs**, `overlayDelayMs` 보정, threshold 초과 시 warning.
- 상세 알고리즘·버퍼 pruning: [Frame-Matching-Report](Frame-Matching-Report.md).

### 장애·디버그

- `frameId=n/a`, payload 누락, IoU track 매핑 버그 등: [Frame-Sync-Debug-Report](Frame-Sync-Debug-Report.md).

### 후속 (미구현)

- WebRTC **DataChannel**에 video+metadata 단일 세션: [Plan-WebRTC-DataChannel-Sync](Plan-WebRTC-DataChannel-Sync.md) (`status: planned`). 현재 기본 표시는 MJPEG — [mjpeg-display-rollback](mjpeg-display-rollback.md).

## Result

### 검증 완료

- Frontend `test:overlay-sync` — contract·behavior (다중 카메라 시나리오 포함) **PASS** (Multi-Camera-Frame-Latency-Report 기록).
- AI payload schema 1.1, py_compile·dry-run·MQTT 덤프 검증 (Frame-Sync-Debug-Report).
- Worker 세션 EOF 시 track/LSTM 초기화: [Multi-Camera-Worker-Session-Reliability](Multi-Camera-Worker-Session-Reliability.md).

### 부분 검증

- 운영·시연에서 delay 보정 매칭 및 warning 플래그로 오정렬 관측.
- MJPEG 경로에서 worker와 표시가 동일 프로세스에 가깝게 정렬.

### 미검증

- 모든 카메라·장시간 **frame-perfect** 오차 통계.
- WebRTC 재생 프레임과 overlay `frameId` 직접 결합 (플레이어가 frameId를 주지 않으면 timestamp fallback 의존).

## Limit

- `capturedAtMs`는 **로컬 캡처 시각**일 수 있어 원본 카메라 타임스탬프와 다를 수 있음.
- Exact sync는 DataChannel 계획 또는 플레이어 API 확장 필요.

## Evidence

- PR/코드: `ai/frame_sync.py`, `ai/publishers/mqtt_payloads.py`, `front/.../overlaySync.ts`
- 테스트: `front/scripts/verify-overlay-sync-*.mjs`, `ai/tests` (frame_sync 관련)
- 관련 Wiki: 본 문서가 **읽기 시작점**; 세부는 위 `relatedDocs` 링크

## 문서 맵 (중복 정리)

| Slug | 역할 |
|------|------|
| **Frame-Sync-Canonical** (본 문서) | 통합 STAR + 맵 |
| ED-FrameId-Evidence-Overlay-Sync | Decision |
| Frame-Matching-Report | Implementation 상세 |
| Frame-Sync-Debug-Report | Incident·payload 검증 |
| Multi-Camera-Frame-Latency-Report | Latency·queue·파이프라인 |
| Plan-WebRTC-DataChannel-Sync | Planned |
| 2026-06-30-Overlay-Tracking-Evidence-Log | Obsidian raw log (`archived`) |
