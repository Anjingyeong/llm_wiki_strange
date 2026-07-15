---
title: Develop 코드 기준선 (2026-07-15)
navTitle: Develop 기준선
shortTitle: Develop 기준선
category: Project
tags: [develop, sync, ai, back, front, vlm, faint, baseline]
relatedDocs: [AI-Pipeline, VLM-RAG-DBless-Mock-MVP, Evidence-VLM-RAG-Event-Search-Decision, ED-Snapshot-VLM-Side-Channel, Realtime-Camera-Runtime-Stabilization]
relatedFiles: [ai/ai/action/faint_post_processing.py, back/SMART_SAFETY_VLM.md, ai/docs/SMART_SAFETY_VLM.md, ai-pipeline-stabilization-source.md]
updatedAt: 2026-07-15
project: smart-safety
type: baseline
portfolio_use: true
---

## 한 줄 요약

`strangeRookies/ai`, `back`, `front`의 **원격 `develop` HEAD**와 로컬 작업 트리를 대조한 기준선이다. 실험·벤치 수치는 `ai-pipeline-stabilization-source.md`를 유지하고, **구현 사실**은 이 문서와 링크된 코드 경로를 따른다.

## 원격 develop HEAD (GitHub API, 2026-07-15)

| 저장소 | SHA (short) | 최근 커밋 메시지 |
| --- | --- | --- |
| strangeRookies/ai | `27093423` | fix: 알림 시간 수정 (`faint_post_processing` cooldown 60s) |
| strangeRookies/back | `762e4ff4` | fix: 빌드 오류 해결 |
| strangeRookies/front | `ab5fda5b` | Merge `origin/feature/admin` into `feature/admin` |

로컬 nested clone (`이상행동/ai|back|front`)은 동기화 전 **`vlm-home-draft-hardening`** 에 있을 수 있다. develop 기준으로 읽을 때는 `git fetch` 후 `develop` checkout·pull을 먼저 수행한다.

동기화 스크립트: `이상행동/.agents/wiki-goal/sync-develop-and-wiki.ps1`

## ai-pipeline-stabilization-source.md 역할 (재확인)

| 역할 | 내용 |
| --- | --- |
| 문제·판단·실험 | YOLO26n 선정, 54D motion, TensorRT, RTSP 4채널, tracking stabilization, evidence chain |
| 수치 | Faint Recall/F1, FPS, YOLO/LSTM latency, TensorRT % — **데이터셋·조건별로 직접 비교 금지** (문서 §1 주의) |
| Wiki 반영 | Canonical 표·ADR·Evidence 페이지로 **추출**; 원문 813줄 전체 게시는 하지 않음 |

## develop 코드에서 확인된 구현 (로컬 + 원격 develop 패치)

### AI 파이프라인 (develop와 정합)

- YOLO26n-pose, Simple tracker, 54D motion, TensorRT validate-or-fallback — `AI-Pipeline.md` 및 stabilization source와 일치.
- **2026-07-15 develop**: `ai/action/faint_post_processing.py`에서 `DEFAULT_EXIT_COOLDOWN_SECONDS` / `DEFAULT_HAZARD_COOLDOWN_SECONDS`가 **60.0**으로 변경됨 (이전 Wiki/로컬 일부는 15.0 기준).
- VLM: `process_vlm.py`, OpenCV keyframe ≤6, mock 기본, `vlm.enabled` 기본 false (back 설정) — `back/SMART_SAFETY_VLM.md`, `ai/docs/SMART_SAFETY_VLM.md`.
- Snapshot assist side-channel — `ED-Snapshot-VLM-Side-Channel.md` (부분 구현).

### VLM·RAG (vlm-home-draft-hardening ↔ develop 병행 시)

| 항목 | 상태 |
| --- | --- |
| Enqueue / Scheduler / mock worker / in-memory mock RAG | 구현·테스트 하네스 존재 (`VLM-RAG-DBless-Mock-MVP.md`) |
| 실 Gemini, 운영 S3, RDS pgvector live | **INTEGRATION_PENDING** |
| Front semantic search | `VITE_VLM_MOCK_SEARCH` opt-in; 운영 API 기본 유지 |

`vlm-home-draft-hardening` 브랜치 문서(`SMART_SAFETY_VLM.md`)는 develop에 아직 전부 머지되지 않았을 수 있다. Wiki는 **develop에 실제로 있는 경로**와 **draft hardening 문서**를 구분해 표기한다.

## Wiki 갱신 체크리스트 (이번 패스)

1. `Develop-Code-Baseline-2026-07-15.md` (본 문서) 추가
2. `AI-Pipeline.md` — faint cooldown·develop SHA footnote
3. `VLM-RAG-DBless-Mock-MVP.md` / `ED-Snapshot-VLM-Side-Channel.md` — hardening·baseline 링크
4. `ai-pipeline-stabilization-source.md` frontmatter `updatedAt` 유지 (실험 원문 날짜 2026-07-14)
5. `npm run generate:index` → `npm run rag:index` → `npm test`

## 한계

- 이 Composer 세션에서는 nested repo `git pull`이 bash 정책으로 차단될 수 있음 → PowerShell 스크립트로 동기화.
- develop HEAD는 API 시점 스냅샷; pull 후 `git rev-parse HEAD`로 재확인.