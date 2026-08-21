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

## 1. Why I built it

실시간 AI 프로젝트를 진행하면 코드만큼이나 **의사결정의 근거**가 많이 쌓입니다.

예를 들면:

```text
왜 이 모델을 선택했지?
왜 threshold를 이 값으로 바꿨지?
지연이 가장 컸던 구간은 어디였지?
이 구조를 다른 방식 대신 선택한 이유는 무엇이지?
```

모델 benchmark, 장애 분석, 파라미터 변경, 운영 결정이 여러 Markdown 문서에 흩어지기 시작하면 나중에는 **결과보다 이유를 찾는 데 더 많은 시간**이 들었습니다.

단순 keyword search는 표현이 달라지면 놓치는 문서가 생기고, 반대로 모든 문서를 LLM에게 그대로 넘기는 방식은 비용과 grounding 측면에서 비효율적이었습니다.

그래서 이 프로젝트를:

> **정적 문서를 보는 Wiki에서, 프로젝트의 결정 근거를 검색하고 질문할 수 있는 지식 시스템으로 확장**

하기 위해 만들었습니다.

---

## 2. Problem definition

이 프로젝트가 해결하려는 문제는 "챗봇 만들기"가 아닙니다.

목표는 다음 세 가지였습니다.

### Find

정확한 기술 용어가 포함된 문서와 의미가 비슷한 문서를 모두 찾을 것.

### Ground

답변이 실제 프로젝트 문서에서 나온 것인지 추적 가능할 것.

### Survive provider failure

외부 LLM API가 없거나 실패해도 문서 검색 자체는 계속 동작할 것.

이 세 목표 때문에 단순 vector-only RAG 대신 Hybrid Retrieval 구조를 선택했습니다.

---

## 3. How it works

```text
User Question
      ↓
┌────────────────────────┐
│ Hybrid Retrieval       │
│                        │
│ BM25 / Exact Lexical   │
│ Vector / Cosine        │
└──────────┬─────────────┘
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

## 4. Why Hybrid Retrieval?

기술 문서는 검색 방식마다 강점이 다릅니다.

### Lexical retrieval이 강한 경우

- 정확한 model name
- environment variable
- port number
- class/function name
- 특정 metric 이름

예:

```text
YOLO26n-pose
selected-missing
FrameSyncBuffer
MQTT
```

### Vector retrieval이 강한 경우

사용자가 문서와 다른 표현으로 질문할 때 유리합니다.

```text
"영상이 늦게 뜬 이유"
vs
"streaming latency bottleneck"
```

따라서 둘 중 하나를 고르는 대신 결과 순위를 RRF로 결합했습니다.

```text
BM25 / Exact Term ─┐
                   ├─→ RRF → Dedupe → Top-K
Vector / Cosine ───┘
```

---

## 5. Why Reciprocal Rank Fusion?

lexical score와 vector score는 값의 의미와 범위가 다릅니다. 단순히 raw score를 더하면 한 retriever가 과도하게 지배할 수 있습니다.

RRF는 각 검색기의 **순위 자체**를 결합하기 때문에 서로 다른 scoring system을 비교적 단순하고 안정적으로 합칠 수 있습니다.

이 프로젝트에서는 retrieval layer를 복잡한 learned reranker에 바로 의존시키기보다, 먼저 재현 가능하고 설명 가능한 fusion 구조를 선택했습니다.

---

## 6. Why structure-aware chunking?

Markdown 문서를 고정 길이로만 자르면 제목과 본문, 표, 결정 근거가 서로 분리될 수 있습니다.

그래서 문서 구조를 이용한 chunking 실험을 추가했습니다.

지원 schema:

- `legacy-v1`
- `structure-aware-v1`
- `structure-aware-contextual-v1`

목표는 chunk를 단순히 작게 만드는 것이 아니라:

```text
검색 가능한 크기
+
원래 문맥을 잃지 않는 경계
```

를 찾는 것이었습니다.

---

## 7. Grounded answer policy

이 시스템에서 가장 중요한 규칙은 **근거가 없으면 답하지 않는 것**입니다.

```text
Relevant context exists
        ↓
Answer with sources

Relevant context missing
        ↓
Abstain
```

관련 chunk가 없거나 최소 score보다 낮으면 다음과 같이 반환합니다.

```text
관련 문서가 부족함. 문서에서 확인되지 않음.
```

LLM에게 전체 문서를 주고 알아서 답하게 하지 않고, retrieval layer가 선택한 context 안에서만 답변하도록 범위를 제한했습니다.

---

## 8. Why the LLM is optional

RAG 서비스가 외부 LLM quota나 provider 장애에 완전히 종속되면 문서 검색 서비스 자체가 불안정해집니다.

그래서 두 모드를 분리했습니다.

```text
RAG-only Mode
└─ default
   retrieval + local extractive/heuristic answer

LLM Answer Mode
└─ optional
   retrieved context → external model

Provider failure
└─ graceful fallback → RAG-only
```

즉 **검색은 핵심 기능**, 자연어 생성은 선택 기능으로 두었습니다.

---

## 9. Sources are part of the answer

답변에는 가능한 경우 다음 정보를 함께 제공합니다.

- 문서 제목
- section
- document ID
- Wiki link

목표는 "그럴듯한 답변"보다:

> **왜 이 답이 나왔는지 사용자가 다시 원문으로 돌아가 확인할 수 있는 답변**

입니다.

---

## 10. Architecture

```text
content/*.md
     │
     ├─→ Client Search Index
     │
     └─→ Structure-aware Chunking
              ↓
       Local Hash Embedding
              ↓
        Vector Store JSON
              ↓
     ┌───────────────────┐
     │ Retrieval Layer   │
     │ BM25 + Vector     │
     │ RRF + Dedupe      │
     └─────────┬─────────┘
               ↓
          Top-K Context
               ↓
       ┌───────────────┐
       │ Answer Layer  │
       │ Local / LLM   │
       └───────┬───────┘
               ↓
         Answer + Sources
```

Cloudflare 배포에서는 선택적으로 D1을 문서 단위 metadata 저장소로 사용할 수 있습니다. vector와 chunk 본문은 정적 index에 유지해 deployment complexity를 줄였습니다.

---

## 11. Key implementation decisions

### 11.1 File-based vector store first

별도 vector DB를 필수로 두지 않고 `data/ragVectorIndex.json` 기반으로 시작했습니다.

이 선택의 장점:

- 프로젝트 규모에서 운영 복잡도 감소
- 배포/백업 단순화
- corpus hash로 정합성 검증 가능
- retrieval experiment를 파일 단위로 versioning 가능

### 11.2 D1 only for metadata

Cloudflare D1은 문서 제목, 상태, 분류, 태그, 관련 문서, chunk count, corpus hash 등 문서 단위 metadata에 사용하도록 분리했습니다.

### 11.3 Search and answer share the same index

UI search와 RAG answer가 서로 다른 corpus를 보지 않도록 같은 index를 공유합니다.

### 11.4 Evaluation separated from production index

Golden Query Dataset과 experiment 결과를 운영 index와 분리해, 실험 과정이 실제 검색 결과를 즉시 오염시키지 않도록 했습니다.

---

## 12. Tech stack

| Layer | Stack |
| --- | --- |
| Language | TypeScript / JavaScript |
| Runtime | Node.js |
| Wiki | Static web app |
| Lexical retrieval | BM25 / Exact-term search |
| Vector retrieval | Local hash embedding / cosine similarity |
| Fusion | Reciprocal Rank Fusion |
| Chunking | Structure-aware Markdown chunking |
| Vector store | Static JSON |
| Metadata | Cloudflare D1 — optional |
| Deployment | Cloudflare Pages / Functions |
| LLM | Gemini · Cloudflare Workers AI · OpenAI-compatible — optional |

---

## 13. Repository map

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
rag-evaluation/                    retrieval evaluation harness
```

---

## 14. Index generation

```bash
# Wiki documents → client search index
npm run generate:index

# Markdown → structure-aware chunks + local embedding vector store
npm run rag:index

# corpus hash consistency check
npm run check:index
```

`npm run build`는 Wiki 검색 인덱스와 RAG vector store를 함께 다시 생성합니다.

검색 흐름:

```text
query
→ BM25
→ Vector cosine
→ RRF fusion
→ document-level dedupe
→ title / snippet / sourcePath / retrieval badge
```

---

## 15. Retrieval evaluation

운영 인덱스를 직접 변경하지 않고 Golden Query Dataset을 이용해 검색 품질을 비교합니다.

```bash
npm run rag:eval
npm run rag:report
npm run rag:leaderboard
```

결과 구조:

```text
rag-evaluation/
├─ datasets/
├─ runs/
├─ baselines/
├─ best.json
└─ leaderboard.csv
```

Chunking 실험:

```bash
npm run rag:chunk-experiment
```

versioned index와 manifest/pointer를 통해 실험 결과와 운영 index를 분리합니다.

---

## 16. Run locally

```bash
npm install
npm run build
npm start
```

기본 endpoint:

```text
Wiki:             http://localhost:4173
RAG health:       GET  /api/rag/health
RAG search:       POST /api/rag/search
RAG question:     POST /api/rag/ask
```

정적 화면만 확인하려면:

```bash
npm run dev
```

RAG API까지 확인하려면 `npm run build && npm start`를 사용합니다.

---

## 17. Environment variables

외부 LLM은 선택 사항입니다.

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

`WIKI_ACCESS_KEY`를 설정하지 않으면 open mode로 동작합니다. 공개 배포에서는 Cloudflare Access / WAF / rate limit 같은 배포 경계 보호를 권장합니다.

---

## 18. Cloudflare D1 metadata

Cloudflare Pages 배포에서는 D1 binding을 `RAG_DB` 이름으로 연결할 수 있습니다.

```bash
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
```

D1 저장 대상:

- 문서 제목 / 상태 / 분류 / 태그
- 관련 문서 / 파일
- 코드 symbol
- 문서별 chunk count
- corpus hash

D1이 없거나 실패하면 기존 static index metadata를 사용하도록 fallback합니다.

---

## 19. API examples

```bash
curl -i http://localhost:4173/api/rag/health
```

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"yolo26n-pose를 선택한 근거는?\"}"
```

검색 근거가 없는 질문에서는 abstention policy가 동작합니다.

---

## 20. Verification

```bash
npm test
npm run lint
npm run build
```

또한 retrieval 품질은 별도의 evaluation harness에서 반복 비교할 수 있도록 구성했습니다.

---

## 21. Limitations

- local hash embedding은 범용 대형 embedding model과 동일한 semantic 표현력을 목표로 하지 않습니다.
- 현재 corpus 규모에 맞춰 static JSON index를 사용하며, 대규모 문서 집합에서는 별도 vector store가 더 적합할 수 있습니다.
- grounded answer는 retrieval 품질에 직접 의존하므로 잘못 검색된 context는 답변 품질을 제한합니다.
- 외부 LLM을 활성화해도 원문에 없는 사실을 보장할 수 없으므로 source 확인이 중요합니다.
- Wiki를 public으로 배포할 경우 인증/WAF/rate-limit 정책은 별도로 구성해야 합니다.

---

## 22. What I learned

이 프로젝트를 통해 RAG에서 중요한 것은 **LLM을 연결하는 것보다 retrieval과 grounding의 경계를 설계하는 것**이라는 점을 배웠습니다.

특히 다음을 직접 비교하고 설계했습니다.

```text
Keyword only       → exact term에는 강하지만 표현 변화에 약함
Vector only        → 의미 검색에는 강하지만 기술 식별자에 약할 수 있음
Hybrid + RRF       → 두 검색기의 장점을 결합

LLM always-on      → 자연스럽지만 provider 의존성 증가
RAG-only fallback  → 기능 가용성과 추적성 유지
```

결과적으로 이 프로젝트의 핵심은 챗봇 UI가 아니라 **문서 검색, 근거 선택, source 추적, 실패 시 fallback까지 포함한 지식 시스템 설계**입니다.

---

## Portfolio documentation

- [LLM Wiki RAG Technical Note](docs/rag-portfolio.md)

---

<div align="center">

**Search the decision. Trace the evidence.**

</div>
