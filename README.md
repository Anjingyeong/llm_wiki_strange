# Smart Safety AI Wiki

실시간 영상관제 시스템의 설계·실험·운영 근거

Smart Safety Monitoring 프로젝트 문서를 정적 Wiki와 서버 측 RAG 질의응답으로 제공한다.

Hybrid RRF + local hash embedding. 현재 운영 중인 인덱스는 48개 문서, 658개 청크(structure-aware-contextual-v1 스키마) 규모로 구성되어 있습니다. WIKI_ACCESS_KEY 미설정 시 공개(open)로 동작합니다.

## Portfolio Documentation

- [LLM Wiki RAG Technical Note](docs/rag-portfolio.md): LLM Wiki 프로젝트의 RAG 아키텍처, 구현 결정, 기술 선택 등을 설명한다. 포트폴리오 제출용으로 작성되었다.

## 실행

```bash
npm install
npm run build
npm start
```

- Wiki: `http://localhost:4173`
- RAG health check: `GET /api/rag/health`
- RAG question API: `POST /api/rag/ask`

개발 서버는 정적 화면 확인용이다.

```bash
npm run dev
```

RAG API까지 확인하려면 `npm run build && npm start`로 Node 서버를 실행한다.

## RAG 구조

질문 처리 흐름은 다음 순서를 따른다.

```text
사용자 질문
→ BM25 / Exact-term Lexical Retrieval
→ Vector Retrieval (Local Hash Embedding & Cosine Similarity)
→ Reciprocal Rank Fusion (RRF)
→ 문서 중복 제거 및 결과 다양화 (문서별 최대 2개 청크 제한)
→ Top-K Context 구성 (최종 6개 Context, 최대 4800자 제한)
→ RAG-only 또는 선택적 LLM 답변 (외부 API 호출)
→ 참고 문서와 Wiki 링크 표시
```

현재 저장 구조는 기존 DB를 바꾸지 않는 파일 기반 vector store(`data/ragVectorIndex.json`)입니다.

## 문서 제목 정책

Wiki 문서는 정식 `title`과 UI 표시용 `displayTitle`/`navTitle`을 분리한다. 정식 `title`은 문서 의미를 보존하고, `displayTitle`은 본문 헤더·사이드바·검색 결과에서 가장 직관적인 제목으로 사용한다. 표시 우선순위는 `displayTitle || navTitle || shortTitle || title || slug`다.

- 원문 문서: `content/*.md`
- 클라이언트 보조 검색 인덱스: `src/generated/searchIndex.ts` (`npm run generate:index`)
- Hybrid RAG vector store: `data/ragVectorIndex.json` (`npm run rag:index`)
- Hybrid 검색 코어: `scripts/lib/rag/search.mjs` + `retrievers.mjs` (BM25 + Vector + RRF)
- Hybrid 검색 API 포맷: `scripts/lib/rag/search-api.mjs`
- 서버 API: `server.mjs` (`POST /api/rag/search`, `POST /api/rag/ask`)
- Cloudflare Functions: `functions/api/rag/search.js`, `functions/api/rag/ask.js`

### Hybrid 검색 인덱스 생성

```bash
# 1) Wiki 문서 frontmatter/본문 → 클라이언트 검색 인덱스
npm run generate:index

# 2) content/*.md → structure-aware chunk + local embedding vector store
npm run rag:index

# 3) corpus hash 정합 확인
npm run check:index
```

`npm run rag:index`는 문서를 섹션 단위 chunk로 나누고 local hash embedding을 생성해 `data/ragVectorIndex.json`에 저장한다. UI Hybrid 검색(`POST /api/rag/search`)과 RAG 답변(`POST /api/rag/ask`)은 이 인덱스를 공유한다.

검색 흐름:

```text
query
-> BM25(keyword)
-> Vector(cosine)
-> RRF fusion
-> document-level dedupe (Top-K)
-> UI: title / snippet / sourcePath / type / keyword|vector badges
```

커밋 대상:
- content 변경 후 갱신된 `src/generated/searchIndex.*`, `data/ragVectorIndex.json`, active `data/rag/*` pointer/manifest
- 커밋하지 않음: `rag-evaluation/runs/`, `terminals/`, 로컬 `.env`

### Retrieval evaluation (baseline harness)

검색 품질은 운영 인덱스를 바꾸지 않고 Golden Query Dataset으로 자동 평가한다. 기본 모드는 pure vector `baseline`이다.

```bash
npm run rag:eval
npm run rag:report
npm run rag:leaderboard
```

결과 위치: `rag-evaluation/` (`datasets/`, `runs/`, `baselines/`, `best.json`, `leaderboard.csv`).  
평가 원칙·승격 정책: `rag-evaluation/config/`. 문제 분석: `rag-evaluation/baseline-search-problems.md`.

### Chunking experiments (stage-2)

Legacy chunking is preserved (`legacy-v1`). Structure-aware schemas:

- `structure-aware-v1`
- `structure-aware-contextual-v1`

```bash
npm run rag:chunk-experiment
```

Versioned indexes: `data/rag/indexes/*.json`
Manifest/pointer: `data/rag/index-manifest.json`, `data/rag/current-index.json`
Promotion updates `best.json` and the operational pointer only when policy passes.

`npm run build`는 Wiki 검색 인덱스와 RAG vector store를 모두 다시 생성하므로, 배포 전 문서 수정분이 반영된다.

## Grounded Answer Policy

- API key는 브라우저로 전달하지 않는다. LLM 호출은 `server.mjs` 내부에서만 수행한다.
- 외부 LLM에는 전체 원문이 아니라 vector search 및 lexical search의 결합(RRF)으로 선택된 관련 chunk만 전달한다.
- 관련 chunk가 없거나 매칭 점수가 최저 점수(minScore) 미만인 경우 추측하지 않고 `관련 문서가 부족함. 문서에서 확인되지 않음.`을 반환합니다(Abstention Policy).
- LLM API가 설정되지 않았거나 실패하면 로컬 추출형 답변을 사용합니다. 이 답변도 검색된 chunk 문장만 사용합니다.
- 답변에는 가능한 경우 문서 제목, 섹션명, 문서 ID, Wiki 링크를 `sources`로 반환하여 신뢰성과 투명성을 제공합니다.

## RAG-only Mode & LLM Answer Mode

LLM Wiki는 Hybrid RAG 검색을 기본 기능으로 제공하고, LLM 답변 생성은 선택적 모드로 분리했습니다. 무료티어 API의 쿼터 제한이나 장애 상황에서도 검색 결과 기반 fallback이 동작하도록 설계해 데모 안정성과 운영성을 확보했습니다.

- **RAG-only Mode (Default)**: 외부 LLM API 연결 없이 작동하는 기본 모드입니다. 로컬 정교화 템플릿(Local Heuristic Template)에 기반해 정확한 인덱스 출처 카드와 문맥 텍스트 요약을 사용자에게 표시합니다.
- **LLM Answer Mode**: 환경변수를 활성화했을 때 동작하는 모드입니다. RRF 및 Re-ranking을 거친 고품질 Context (최대 8개 청크, 최대 4,800자 범위 제한)를 외부 LLM에 전달하여 고품질의 자연어 답변을 완성합니다.
- **Graceful Fallback**: API Key 미비, 네트워크 오류, Timeout(기본 10초), Rate Limit 등의 이슈로 LLM 호출이 실패할 경우, 에러 코드를 사용자에게 직접 노출하는 대신 **RAG-only Mode의 로컬 답변으로 자동 Fallback**하도록 처리하여 전체 서비스 가용성을 유지합니다.

## Environment Variables

외부 LLM은 선택 사항입니다. 무료/저비용 운영을 위해 기본값은 로컬 embedding과 로컬 추출 답변입니다.
```bash
PORT=4173
WIKI_ACCESS_KEY= # unset → open; set → protected (server-side)
# Wiki is open by default; protect public deployments with Cloudflare Access/WAF/rate limits.

# LLM Answer Mode 설정
ENABLE_LLM_ANSWER=false # LLM 자연어 답변 활성화 여부 (기본값: false)
LLM_PROVIDER=none # none, mock, gemini, cloudflare, openai (기본값: none)
LLM_MODEL= # 비워둘 경우 각 프로바이더의 디폴트 모델 사용 (예: gemini-1.5-flash)
LLM_TIMEOUT_MS=10000 # 타임아웃 임계치 (기본값: 10000)
LLM_MAX_CONTEXT_CHUNKS=8 # LLM에 넘길 최대 context 청크 수 (기본값: 8)
LLM_MAX_OUTPUT_TOKENS=800

# Google Gemini API 설정
GEMINI_API_KEY=

# Cloudflare Workers AI 설정
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# OpenAI API 설정
OPENAI_API_KEY=
```

## Cloudflare D1 RAG metadata

> [!WARNING]
> Wiki 문서와 RAG API는 WIKI_ACCESS_KEY 미설정 시 공개(open)입니다. 보호된 배포에서는 Cloudflare Access/WAF/rate limit 등 배포 경계에서 보호하세요.

Cloudflare Pages 배포에서는 D1 binding을 `RAG_DB` 이름으로 연결할 수 있다. `DB`도 호환 이름으로 인식하지만 새 배포는 `RAG_DB`를 권장한다.

```bash
# D1 데이터베이스 생성 후 실제 데이터베이스 이름으로 실행
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
```

- 마이그레이션: `migrations/0001_rag_metadata.sql`
- 저장 대상: 문서 제목, 상태, 분류, 태그, 관련 문서·파일, 코드 심볼, 문서별 chunk 수, corpus hash
- 동기화: 정적 RAG 인덱스의 `corpusHash`가 D1 상태와 다르면 최초 검색·질의 요청에서 자동 upsert
- fallback: D1 binding이 없거나 실패하면 기존 `data/ragVectorIndex.json` 메타데이터 사용
- 범위: 벡터와 chunk 본문은 정적 JSON에 유지하고 D1은 문서 단위 메타데이터를 담당

Cloudflare Pages의 D1 database bindings에서 변수 이름을 `RAG_DB`로 지정한다. Wiki와 RAG API는 별도 접근 키 없이 공개된다.

OpenAI 호환 chat-completions API를 사용하는 경우, `OPENAI_API_KEY`(또는 레거시 호환용 `RAG_LLM_API_KEY`)를 설정하고 `LLM_MODEL` 환경변수를 설정해 원하는 모델(기본값: `gpt-4o-mini`)을 지정할 수 있습니다. (주: 코드베이스상 `RAG_LLM_ENDPOINT` 및 `RAG_LLM_MODEL`은 직접 파싱되지 않으며, `OPENAI_API_KEY`와 `LLM_MODEL`이 사용됩니다.)

## API Examples

```bash
curl -i http://localhost:4173/api/rag/health
```

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"yolo26n-pose를 선택한 근거는?\"}"
```

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"사내 급여 정책은 무엇인가요?\"}"
```

## Verification

```bash
npm test
npm run lint
npm run build
```
