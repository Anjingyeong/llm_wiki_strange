---
title: Wiki Ops Sync (internal)
navTitle: Wiki Ops Sync
category: Internal
type: ops
audience: [maintainer]
implementationStatus: reference
verificationLevel: internal
---

## Wiki 갱신 체크리스트 (2026-07-16)
1. `Develop-Code-Baseline-2026-07-15.md` (본 문서) 추가
2. `AI-Pipeline.md` — faint cooldown·develop SHA footnote
3. `VLM-RAG-DBless-Mock-MVP.md` / `ED-Snapshot-VLM-Side-Channel.md` — hardening·baseline 링크
4. `ai-pipeline-stabilization-source.md` frontmatter `updatedAt` 유지 (실험 원문 날짜 2026-07-14)
5. `Benchmark-Evidence-Hub.md`, MQTT/RTSP Evidence — **2026-07-16** `rag:spotcheck` 4/4 PASS (48 docs, 614 chunks)
6. `npm run generate:index` → `npm run rag:index` → `npm run rag:spotcheck` → `npm test`

## 동기화 스크립트
- `이상행동/.agents/wiki-goal/sync-develop-and-wiki.ps1`

## 로컬 develop 재확인
`sync-develop-and-wiki.ps1` 실행 후 `이상행동/ai|back|front` 모두 **`develop` = origin/develop** (변경 없음).

## 참고
- Wiki 로컬 잔여: `rag-evaluation/*` 갱신, `public/_redirects`, 미추적 `public/wiki-ux-meta.json` — `npm run generate:index` 시 생성물.
