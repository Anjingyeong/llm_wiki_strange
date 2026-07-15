# Wiki Canonical Registry (중복 방지)

목표: 공개 **49**편 → **약 30~35** Canonical + 나머지 Archive/Obsidian/Redirect.

## 1. YOLO26n 선택 (3편 → 2편)

| Slug | 역할 | 조치 |
|------|------|------|
| **Model-Comparison** | Canonical 실험·수치 | 유지. 제목: `YOLO Pose 6종 비교와 YOLO26n 선택 근거` |
| **ADR-003-YOLO26n-Selection** | Canonical 결정만 | 유지. navTitle: `YOLO26n 선택 이유` |
| Model-Decision-YOLO26n | 중복 요약 | **Redirect stub** → 위 두 문서만 링크 |

## 2. 51D·54D (3편 → 3역할 분리)

| Slug | 역할 | 조치 |
|------|------|------|
| **Feature-Vector-51D-vs-54D** | 실험·수치 | 유지. 운영 승격 **대기** 명시 |
| **ADR-004-LSTM-Feature-Expansion** | 결정 | `status: partial` — 채택했으나 production 승격 보류 |
| **LSTM** | 현재 입력 계약만 | 실험 수치는 Feature-Vector 링크 |

## 3. WebRTC·MJPEG (충돌)

| Slug | 역할 | 조치 |
|------|------|------|
| ADR-001-WebRTC | 과거 결정 | `status: superseded`, `supersededBy: mjpeg-display-rollback` |
| **mjpeg-display-rollback** | 현재 display transport | Canonical. navTitle 강화 |
| MJPEG-Streaming-Rollback-Report | 상세 | mjpeg-display-rollback로 **흡수** 또는 archived |
| WebRTC-vs-HLS | 비교 참고 | `status` 유지, “현재 기본은 MJPEG” 한 줄 |

## 4. Frame sync (통합 Canonical)

| Slug | 역할 | 조치 |
|------|------|------|
| **Frame-Sync-Canonical** | **읽기 시작점** (`canonicalFor: frame-overlay-sync`) | 신규 2026-07-15 |
| ED-FrameId-Evidence-Overlay-Sync | Decision | Canonical 링크 |
| Frame-Matching-Report | Implementation | 상세 |
| Frame-Sync-Debug-Report | Incident | 유지 |
| Multi-Camera-Frame-Latency-Report | Latency·queue | 유지 |
| 2026-06-30 / 2026-07-02 daily logs | Raw | `archived` stub |
| Plan-WebRTC-DataChannel-Sync | Plan | `planned` |

## 4b. Standing Faint (신규)

| Slug | 역할 |
|------|------|
| **ED-Standing-Faint-Upright-Gate** | PR #83 STAR, `partial` |
| **Bug-Duplicate-Stream-Binding** | PR #16 DEV 중복 stream 경고 | 2026-07-15 |

## 5. VLM·RAG

| Slug | 역할 | 조치 |
|------|------|------|
| **VLM-RAG-DBless-Mock-MVP** | Experiment (모범) | Canonical |
| ED-Snapshot-VLM-Side-Channel | Decision | Canonical |
| Evidence-VLM-RAG-Event-Search-Decision | 혼합 | ADR/Architecture/Interview **분리** (장기) |

## 6. Tracking

| Slug | 역할 | 조치 |
|------|------|------|
| **Tracking-Association-Stabilization** | STAR + PARTIAL live | 상단 status 박스 필수 |
| Tracking-Association-Offline-AB-2026-07-13 | Offline 원인 | Canonical 보조 |

## 7. Obsidian 이동 후보 (Wiki `archived` 또는 export-only)

- `2026-06-30-Overlay-Tracking-Evidence-Log`
- `2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log`
- `Interview-Resume-Notes`
- `Evidence-Portfolio-Resume-Usage`
- `Graphify-Semantic-Map` (내부 도구 메모 성격 시)

이동 시: `content/`에서 삭제하지 말고 먼저 Obsidian export → `status: archived` + MOC에서 제거 → 검색 인덱스에서 `wikiVisibility: internal` 검토(후속).

## Metadata·검색 (적용)

- `generate-search-index.mjs`: `status: archived` · `wikiVisibility: internal` 제외
- ADR-001 superseded, ADR-004 partial, Tracking partial, Model-Decision redirect
- Frame-Sync-Canonical, ED-Standing-Faint-Upright-Gate 추가