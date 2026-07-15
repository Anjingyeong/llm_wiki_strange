# LLM Wiki 정보 구조 (2026-07-15)

공개 Wiki(`content/`)는 **현재 시스템·검증된 결정·계약**만 담는다. 날짜별 작업 로그·면접 메모·미검증 초안은 **Obsidian**(`C:\옵시디안`)으로 분리한다.

## 문서 유형 (형식 고정)

| 유형 | 형식 | 예 |
|------|------|-----|
| 프로젝트·실험·문제 해결 | STAR (Result를 완료/부분/미검증으로 분리) | Model-Comparison, Tracking-Association-Stabilization |
| 기술 선택 | ADR + `status` | ADR-003, ADR-004 |
| API·MQTT·JSON | Contract | AI-Output-JSON, MQTT-Event-Schema |
| 장애 | Incident Report | Bug-RTSP-Stream-404 |
| 운영 | Runbook | Realtime-Camera-Runtime-Stabilization |
| 미래 작업 | Plan/Roadmap | Plan-WebRTC-DataChannel-Sync |

## 제목 규칙

> **무슨 문제를 + 어떤 방법으로 + 어떤 결과·결정을 냈는가**

- `title`: 정식 제목 (검색·RAG·인용)
- `navTitle`: 사이드바 15~25자
- `shortTitle`: 배지·짧은 링크

## Frontmatter 권장 필드

```yaml
type: decision | experiment | contract | incident | runbook | plan | meta | daily-log
status: verified | partial | planned | superseded | archived
evidenceLevel: code-only | unit-test | offline-benchmark | live-canary | production
canonicalFor: tracking-association   # 선택: 이 주제의 대표 slug
productionStatus: default | rollback | held | none
supersedes: []
supersededBy: null
verifiedAt: 2026-07-14
prRefs:
  - strangeRookies/ai#80
```

`status`와 `evidenceLevel`만 있어도 **코드 존재 ≠ 운영 검증** 혼동을 줄일 수 있다.

## STAR 템플릿 (실험·판단 문서)

```markdown
# 결과가 드러나는 제목

> 한 줄 결과: 무엇을 바꿨고 어떤 수치·판단을 얻었는가

## Situation
## Task
## Action
## Result
### 검증 완료
### 부분 검증
### 미검증
## Evidence
## 한계와 다음 실험
```

## Wiki vs Obsidian

**Wiki에 남김:** 구조, 검증된 ADR, 수치 실험, 재현 가능한 장애 해결, 계약, Runbook, Evidence Map.

**Obsidian으로:** `2026-06-30-*`, `2026-07-02-*` 작업 로그, `Interview-Resume-Notes`, `Evidence-Portfolio-Resume-Usage`, Codex 실행 로그, 면접·이력서 초안, 미검증 Plan 초안.

권장 Obsidian 트리:

```text
04_Projects/Smart_Safety_AI/
  Raw_Logs/          ← wiki daily logs export
  Interview/         ← Interview-Resume-Notes 등
02_Maps/
  Wiki Canonical MOC ← 공개 30~35편만 링크
```

## 작업 순서 (로드맵)

1. **상태 충돌 수정** — ADR-001 superseded, ADR-004 partial, Tracking PARTIAL 상단 고정
2. **중복 통합** — YOLO 3종, 54D 3종, MJPEG 2종, Frame sync 클러스터 (registry 참고)
3. **제목·navTitle** — Model-Comparison, ADR-003 등
4. **최근 PR 누락 문서** — `wiki-pr-evidence-backlog.md`
5. **Obsidian 분리** — export 후 wiki에서 `archived` 또는 redirect stub

## PR 제목·본문 (앞으로)

제목: `fix(ai): 재연결 구간 motion spike로 standing Faint 오탐 방지`

본문 최소: Problem → Decision → Changes → Result → Not verified → Evidence (Wiki slug)

## 관련 문서

- [wiki-canonical-registry.md](./wiki-canonical-registry.md) — 중복 맵·canonical slug
- [wiki-pr-evidence-backlog.md](./wiki-pr-evidence-backlog.md) — PR→Wiki 후보
- [obsidian-export.md](./obsidian-export.md) — Obsidian 동기화