<div align="center">

# 📚 Smart Safety AI Wiki

### Hybrid RAG Knowledge System for a Real-time AI Project

**실시간 영상관제 프로젝트의 설계·실험·운영 근거를 Wiki와 서버사이드 RAG로 탐색할 수 있게 만든 지식 시스템입니다.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![RAG](https://img.shields.io/badge/RAG-Hybrid_Retrieval-7C3AED?style=flat-square)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages_%2F_Functions-F38020?style=flat-square&logo=cloudflare&logoColor=white)

`BM25 · Vector Retrieval · RRF · Structure-aware Chunking · Grounded Answer`

</div>

---

## Why I built it

실시간 AI 프로젝트를 진행하면 모델 선택 이유, 지연시간 실험, 파라미터 변경, 장애 원인, 운영 결정 같은 정보가 계속 쌓입니다.

문제는 프로젝트가 커질수록 이런 근거가 여러 Markdown 문서와 기록에 흩어진다는 점이었습니다.

```text
"왜 이 모델을 선택했지?"
"이 파라미터 값은 왜 이렇게 정했지?"
"그때 지연 문제가 어디에서 발생했지?"
```

단순 문서 검색만으로는 질문의 표현이 달라지면 원하는 근거를 찾기 어렵고,
LLM에게 전체 문서를 던지는 방식은 비용과 신뢰성 문제가 있습니다.

그래서 **정적 Wiki + Hybrid Retrieval + Grounded Answer** 구조를 만들었습니다.

> **프로젝트 문서를 읽는 페이지에서, 프로젝트의 결정 근거를 질문할 수 있는 시스템으로.**

---

## Core flow

```text
User Question
      ↓
┌───────────────────────┐
│ Hybrid Retrieval      │
│                       │
│ BM25 / Exact Lexical  │
│ Vector / Cosine       │
└──────────┬────────────┘
           │
           ▼
      RRF Fusion
           ↓
Document Dedupe / Diversity
           ↓
Top-K Context
           ↓
┌──────────────────────────┐
│ Grounded Answer          │
│                          │
│ RAG-only local answer    │
│ or Optional external LLM │
└────────────┬─────────────┘
             ↓
      Answer + Sources
```

현재 운영 인덱스는 **48개 문서 / 658개 chunk** 규모의 `structure-aware-contextual-v1` 스키마를 사용합니다.

---

## What makes it different

### 1. Hybrid retrieval

키워드가 정확히 일치하는 기술 문서는 lexical retrieval이 강하고,
질문의 표현이 달라진 경우 vector retrieval이 유리합니다.

두 결과를 **Reciprocal Rank Fusion (RRF)** 으로 결합합니다.

```text
BM25 / Exact Term ─┐
                   ├─→ RRF → Top-K
Vector / Cosine ───┘
```

### 2. Structure-aware chunking

Markdown 문서를 단순 고정 길이로 자르지 않고 문서 구조를 이용해 chunk를 생성합니다.

지원 실험 스키마:

- `legacy-v1`
- `structure-aware-v1`
- `structure-aware-contextual-v1`

### 3. Grounded answer policy

검색 근거가 부족하면 LLM이 억지로 답을 만들지 않도록 설계했습니다.

```text
Relevant context exists → answer with sources
Relevant context missing → abstain
```

관련 chunk가 없거나 최소 점수보다 낮으면:

```text
관련 문서가 부족함. 문서에서 확인되지 않음.
```

을 반환합니다.

### 4. LLM is optional

외부 LLM API가 없어도 검색과 로컬 추출형 답변은 동작합니다.

```text
RAG-only Mode      → default
LLM Answer Mode    → optional
Graceful Fallback  → provider failure → RAG-only
```

API quota나 장애가 서비스 전체 장애로 이어지지 않도록 분리했습니다.

### 5. Sources are part of the answer

답변 결과에는 가능한 경우 다음 정보가 함께 제공됩니다.

- 문서 제목
- section
- document ID
- Wiki link

목표는 **그럴듯한 답**보다 **어디에서 나온 답인지 추적 가능한 답**입니다.

---

## Tech stack

| Layer | Stack |
| --- | --- |
| Language | TypeScript / JavaScript |
| Runtime | Node.js |
| Wiki | Static web app |
| Lexical Retrieval | BM25 / Exact-term search |
| Vector Retrieval | Local hash embedding / cosine similarity |
| Fusion | Reciprocal Rank Fusion |
| Metadata | Cloudflare D1 — optional |
| Deployment | Cloudflare Pages / Functions |
| LLM | Gemini · Cloudflare Workers AI · OpenAI-compatible — optional |

---

## Run locally

```bash
npm install
npm run build
npm start
```

Default:

```text
Wiki:             http://localhost:4173
RAG health:       GET  /api/rag/health
RAG search:       POST /api/rag/search
RAG question:     POST /api/rag/ask
```

정적 화면만 확인할 경우:

```bash
npm run dev
```

RAG API까지 확인하려면 `npm run build && npm start`를 사용합니다.

---

# Technical details

## RAG pipeline

질문 처리 흐름:

```text
사용자 질문
→ BM25 / Exact-term Lexical Retrieval
→ Vector Retrieval (Local Hash Embedding & Cosine Similarity)
→ Reciprocal Rank Fusion (RRF)
→ 문서 중복 제거 및 결과 다양화
→ Top-K Context 구성
→ RAG-only 또는 선택적 LLM 답변
→ 참고 문서와 Wiki 링크 표시
```

현재 저장 구조는 기존 DB를 강제하지 않는 파일 기반 vector store입니다.

```text
data/ragVectorIndex.json
```

주요 코드:

```text
content/*.md                       source documents
src/generated/searchIndex.ts      client-side search index
data/ragVectorIndex.json           hybrid RAG vector store
scripts/lib/rag/search.mjs         hybrid retrieval core
scripts/lib/rag/retrievers.mjs     BM25 / vector retrievers
scripts/lib/rag/search-api.mjs     API result formatting
server.mjs                         Node RAG API
functions/api/rag/search.js        Cloudflare search function
functions/api/rag/ask.js           Cloudflare answer function
```

---

## Index generation

```bash
# Wiki documents → client search index
npm run generate:index

# Markdown → structure-aware chunks + local embeddings
npm run rag:index

# corpus hash consistency check
npm run check:index
```

`npm run build`는 Wiki 검색 인덱스와 RAG vector store를 함께 다시 생성합니다.

검색 결과 흐름:

```text
query
→ BM25
→ Vector cosine
→ RRF fusion
→ document-level dedupe
→ title / snippet / sourcePath / retrieval badges
```

---

## Retrieval evaluation

운영 인덱스와 별개로 Golden Query Dataset을 이용해 검색 품질을 평가합니다.

```bash
npm run rag:eval
npm run rag:report
npm run rag:leaderboard
```

평가 결과:

```text
rag-evaluation/
├─ datasets/
├─ runs/
├─ baselines/
├─ best.json
└─ leaderboard.csv
```

운영 인덱스를 직접 변경하지 않고 실험 결과를 비교할 수 있도록 구성했습니다.

---

## Chunking experiments

```bash
npm run rag:chunk-experiment
```

Versioned index:

```text
data/rag/indexes/*.json
```

Manifest / pointer:

```text
data/rag/index-manifest.json
data/rag/current-index.json
```

정책을 통과한 경우에만 operational pointer를 승격하도록 구성합니다.

---

## RAG-only Mode & LLM Answer Mode

### RAG-only Mode — default

외부 LLM 없이 동작합니다.

검색 결과와 로컬 템플릿을 이용해 근거 중심 답변과 source card를 제공합니다.

### LLM Answer Mode — optional

환경변수를 활성화하면 retrieval 결과 중 제한된 context만 외부 LLM에 전달합니다.

전체 원문을 모델에 보내지 않습니다.

### Graceful fallback

다음 문제가 생기면 RAG-only Mode로 자동 fallback합니다.

- API key 없음
- provider error
- timeout
- rate limit
- malformed response

---

## Environment variables

```bash
PORT=4173
WIKI_ACCESS_KEY=

ENABLE_LLM_ANSWER=false
LLM_PROVIDER=none
LLM_MODEL=
LLM_TIMEOUT_MS=10000
LLM_MAX_CONTEXT_CHUNKS=8
LLM_MAX_OUTPUT_TOKENS=800

GEMINI_API_KEY=

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

OPENAI_API_KEY=
```

`WIKI_ACCESS_KEY`가 비어 있으면 Wiki는 open 상태로 동작합니다.
공개 배포 시 Cloudflare Access / WAF / rate limit 등의 배포 경계 보호를 권장합니다.

---

## Cloudflare D1 metadata

Cloudflare Pages 환경에서는 D1 binding을 `RAG_DB` 이름으로 연결할 수 있습니다.

```bash
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
```

D1에는 문서 단위 metadata를 저장하고,
벡터와 chunk 본문은 정적 JSON에 유지합니다.

저장 대상 예:

- document title
- status / category / tags
- related files
- code symbols
- chunk count
- corpus hash

D1이 없거나 실패하면 기존 JSON metadata로 fallback합니다.

---

## API examples

Health:

```bash
curl -i http://localhost:4173/api/rag/health
```

Ask:

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"yolo26n-pose를 선택한 근거는?\"}"
```

Abstention 확인 예:

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"사내 급여 정책은 무엇인가요?\"}"
```

---

## Verification

```bash
npm test
npm run lint
npm run build
```

---

## Portfolio documentation

더 깊은 설계 결정은 다음 문서에 정리되어 있습니다.

- [LLM Wiki RAG Technical Note](docs/rag-portfolio.md)

---

<div align="center">

**Search project decisions. Answer from evidence.**

</div>
