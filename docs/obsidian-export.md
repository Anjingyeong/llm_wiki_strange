# Obsidian으로 옮기기

**기본 볼트 (Windows):** `C:\옵시디안`  
**노트 위치:** `03_Knowledge/LLM_Wiki/` (기존 knowledge-manager 볼트 구조와 동일)

## 1. 동기화 (권장)

```powershell
cd C:\llm_wiki_strange
npm run generate:index
npm run export:obsidian
```

- `C:\옵시디안\03_Knowledge\LLM_Wiki\` — Wiki `content/*.md` 49개
- `C:\옵시디안\06_Sources\` — `ai-pipeline-stabilization-source.md`, README
- `C:\옵시디안\99_Meta\Wiki 동기화.md` — 마지막 동기화 안내

Obsidian은 이미 `C:\옵시디안`을 볼트로 열어두면 됩니다. **새 볼트 만들 필요 없음.**

## 2. 볼트에서 읽는 순서

1. [[홈]]
2. [[LLM Wiki 프로젝트]]
3. [[Develop-Code-Baseline-2026-07-15]] (develop 기준선)
4. [[AI-Pipeline]]
5. [[전체 지식 문서 MOC]] — 수동 목차(export 후 신규 문서 행 추가 권장)

## 3. 옵션

```powershell
# 다른 볼트 (레거시 폴더 구조)
npm run export:obsidian -- --out "D:\Vault" --layout legacy

# 원문 제외
npm run export:obsidian -- --no-sources
```

## 4. 주의

- export는 **덮어쓰기**입니다. `03_Knowledge/LLM_Wiki`에서 직접 수정한 내용은 Wiki 쪽이 진실(source of truth)이면 다시 export하면 됩니다.
- Obsidian 전용 메모는 `00_Inbox` 또는 `04_Projects`에 두고, Wiki 본문은 `llm_wiki_strange/content`에서만 고친 뒤 export하는 흐름이 안전합니다.

## 5. RAG / 웹 Wiki

- 검색·RAG 데모: `cd C:\llm_wiki_strange && npm run build && npm start`
- 코드 레포: `이상행동\ai`, `back`, `front`

## 6. GitHub (원격 Wiki)

Obsidian export와 별개로, `content/`·검색/RAG 인덱스 변경은 **저장소 push**가 필요합니다.

```powershell
cd C:\Users\user\.gemini\antigravity\scratch\이상행동
.\.agents\wiki-goal\push-wiki-to-github.ps1
```

또는 `C:\llm_wiki_strange`에서: `npm run generate:index` → `npm run rag:index` → `npm test` → `git add` → `git commit` → `git push origin main`