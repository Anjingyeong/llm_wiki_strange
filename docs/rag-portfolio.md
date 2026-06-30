# LLM Wiki RAG Technical Note

이 문서는 LLM Wiki에 추가된 RAG 기반 질의응답 기능을 포트폴리오 관점에서 설명한다. 구현된 사실만 기준으로 작성했으며, 현재 버전은 별도 상용 vector DB가 아니라 파일 기반 vector store와 local hash embedding을 사용한다.

## 문제 정의

LLM Wiki는 Smart Safety Monitoring 프로젝트의 판단 근거, 아키텍처 결정, 실험 결과, 장애 기록을 Markdown 문서로 관리한다. 단순 챗봇으로 질문을 처리하면 모델이 프로젝트 문서에 없는 내용을 일반 지식으로 보완하거나, 최신 실험 결과와 다른 답을 만들 위험이 있다.

이 기능의 목표는 사용자가 Wiki에서 질문했을 때 모델이 먼저 저장된 문서를 검색하고, 검색된 chunk에 근거가 있을 때만 답변하도록 만드는 것이다. 관련 문서가 없으면 추측 답변을 만들지 않고 `관련 문서가 부족함` 또는 `문서에서 확인되지 않음` 상태로 응답한다.

## 왜 RAG인가

이 프로젝트의 질문은 일반 지식보다 내부 문서의 맥락이 중요하다.

- YOLO26n-pose 선택 이유는 일반 모델 성능표가 아니라 프로젝트의 Faint Recall 우선 정책과 benchmark 기록에 묶여 있다.
- WebRTC vs HLS 판단은 MediaMTX, WHEP, 관제 지연 요구사항을 함께 봐야 한다.
- MQTT metadata 구조는 `cameraLoginId`, event/evidence 식별자, 민감정보 제외 원칙 같은 프로젝트 계약을 따라야 한다.

따라서 답변 흐름을 `질문 -> 검색 -> 관련 chunk -> 근거 기반 답변 -> 출처 표시`로 제한했다. RAG는 LLM을 지식 저장소로 쓰기보다, 저장된 Wiki 문서를 먼저 찾고 그 결과만 답변 컨텍스트로 사용하는 구조다.

## 현재 아키텍처

```text
content/*.md
  -> scripts/generate-rag-index.mjs
  -> scripts/lib/rag/chunks.mjs
  -> scripts/lib/rag/embedding.mjs
  -> data/ragVectorIndex.json
  -> server.mjs /api/rag/ask
  -> scripts/lib/rag/search.mjs
  -> scripts/lib/rag/answer.mjs
  -> src/components/RagPanel.tsx
```

주요 파일은 다음 역할을 가진다.

| 파일 | 역할 |
| --- | --- |
| `content/*.md` | RAG 검색 대상이 되는 Wiki 원문 문서 |
| `scripts/generate-rag-index.mjs` | Markdown frontmatter와 본문을 읽어 RAG 인덱스 생성 |
| `scripts/lib/rag/chunks.mjs` | heading 기반 section 분리, Markdown 정리, chunk 생성 |
| `scripts/lib/rag/embedding.mjs` | local hash embedding과 cosine similarity 계산 |
| `scripts/lib/rag/search.mjs` | 질문 embedding, vector score, keyword overlap을 조합해 top-k chunk 검색 |
| `scripts/lib/rag/answer.mjs` | 근거 부족 처리, local extractive answer, 선택적 외부 LLM 호출 |
| `data/ragVectorIndex.json` | 생성된 파일 기반 vector store |
| `server.mjs` | 서버 측 RAG API 제공 |
| `src/components/RagPanel.tsx` | Wiki 화면의 질문 입력 및 출처 표시 UI |

## 데이터 흐름

질문 처리 흐름은 다음 순서를 따른다.

```text
사용자 질문
-> 질문 embedding 생성
-> vector search
-> 관련 문서 chunk 검색
-> LLM prompt 또는 local extractive answer에 context로 사용
-> 근거 기반 답변 생성
-> 참고 문서 표시
```

`POST /api/rag/ask`는 서버에서 `data/ragVectorIndex.json`을 읽고 `answerQuestionFromIndex`를 호출한다. 응답에는 `status`, `answer`, `sources`가 포함된다. `sources`는 문서 제목, section, 문서 ID, Wiki 내부 링크를 담아 사용자가 답변 근거를 다시 열어볼 수 있게 한다.

## Markdown chunking 방식

인덱스 생성은 `content/*.md` 파일을 대상으로 한다.

1. `scripts/generate-rag-index.mjs`가 frontmatter를 파싱하고 `slug`, `title`, `category`, `updatedAt`, `body`를 구성한다.
2. `chunks.mjs`가 `#`, `##`, `###` heading을 기준으로 section을 나눈다.
3. code fence, Markdown 링크 URL, 표/강조/인용에 쓰이는 일부 기호를 제거해 plain text로 정리한다.
4. section 본문을 기본 `1100`자 단위 chunk로 나눈다.
5. 각 chunk는 `documentId`, `slug`, `title`, `category`, `section`, `text`, `updatedAt`, `embedding`을 가진다.

이 방식은 구현이 단순하고 Markdown 문서 수정 후 재생성이 쉽다. 다만 code fence 내부 내용은 검색 chunk에서 제거되므로, Mermaid 코드 자체나 긴 JSON payload 안의 세부 토큰 검색은 약할 수 있다.

## Local hash embedding 검색

현재 embedding provider는 `local-hash-tfidf`로 표시된다. 실제 구현은 외부 embedding API를 호출하지 않고 다음 방식으로 동작한다.

- 텍스트를 소문자화하고 기호와 공백을 정리한다.
- 토큰을 추출하고 stop word를 제외한다.
- 각 토큰을 stable hash로 256차원 vector bucket에 누적한다.
- vector magnitude로 정규화한다.
- 질문 vector와 chunk vector의 cosine similarity를 계산한다.

검색 점수는 vector similarity와 lexical overlap을 함께 사용한다.

```text
score = cosineSimilarity * 0.7 + keywordOverlapScore * 0.3
```

또한 lexical overlap이 없는 결과는 제외하고, 기본 `minScore`는 `0.08`, 기본 top-k는 `4`개 chunk다. 이 구조는 무료/저비용으로 재현 가능한 검색 품질을 제공하지만, 전용 semantic embedding 모델이나 전문 vector DB 수준의 의미 검색을 목표로 하지는 않는다.

## 외부 LLM 호출 구조

외부 LLM은 기본 동작이 아니라 선택 사항이다. `RAG_LLM_API_KEY`가 없으면 서버는 외부 호출을 하지 않고 검색된 chunk 문장에서 local extractive answer를 만든다.

외부 LLM을 사용할 때도 호출은 브라우저가 아니라 `server.mjs`와 `answer.mjs` 내부에서만 수행된다. 클라이언트는 `/api/rag/ask`만 호출하며 API Key를 전달받지 않는다.

외부 LLM 요청에는 전체 Wiki 원문을 보내지 않는다. `answer.mjs`는 검색된 chunk 중 최대 4개, 최대 3600자 범위만 context로 구성한다. system prompt도 제공된 Wiki context만 사용하고 부족하면 문서에서 확인되지 않는다고 답하도록 제한한다.

관련 환경변수는 다음과 같다.

```bash
PORT=4173
RAG_LLM_API_KEY=
RAG_LLM_ENDPOINT=https://api.openai.com/v1/chat/completions
RAG_LLM_MODEL=gpt-4o-mini
```

## 보안 고려사항

- API Key는 frontend bundle이나 `RagPanel`로 전달하지 않는다.
- 외부 LLM 호출은 서버 측에서만 수행한다.
- 외부 LLM에는 전체 Markdown 원문이 아니라 검색된 관련 chunk만 전달한다.
- 문서에는 실제 RTSP 계정, token, password 같은 민감정보를 넣지 않는다는 Wiki 작성 원칙을 유지한다.
- `server.mjs`는 `/api/rag/reindex`에 대해 `405`를 반환한다. 문서 수정 후 reindex는 서버 관리자가 `npm run rag:index` 또는 `npm run build`로 수행한다.

## Hallucination 방지

답변 생성 전 검색 결과가 없으면 `answerQuestionFromIndex`는 `answered`를 반환하지 않는다.

```json
{
  "status": "insufficient_context",
  "answer": "관련 문서가 부족함. 문서에서 확인되지 않음.",
  "sources": []
}
```

검색 결과가 있을 때도 `sources`를 함께 반환해 사용자가 답변의 근거 문서를 확인할 수 있게 했다. local extractive answer는 검색된 chunk에서 질문 토큰과 겹치는 문장을 우선 선택하고, 외부 LLM이 설정된 경우에도 검색된 context만 전달한다.

## 검증 결과

현재 검증은 단위 테스트, retrieval evaluation, build, API smoke test로 나뉜다.

| 검증 | 확인 내용 |
| --- | --- |
| `npm test` | RAG chunk metadata와 embedding 생성, grounded answer source, 근거 부족 응답, 10개 QA evaluation top-k 검색 |
| `npm run lint` | TypeScript type check |
| `npm run build` | Wiki 검색 인덱스와 RAG vector store 재생성, TypeScript build, Vite production build |
| HTTP smoke test | `/api/rag/health` 200 응답, `/api/rag/ask` answered 및 insufficient_context 응답 |
| Browser verification | Wiki 화면에서 RAG 답변과 참고 문서가 표시되고, 기존 문서 검색/조회로 `WebRTC vs HLS` 문서가 열리는 것을 확인 |

최근 검증에서 `npm run build`는 `src/generated/searchIndex.ts`에 26개 문서, `data/ragVectorIndex.json`에 255개 chunk를 생성했다. QA evaluation set은 YOLO26n-pose 선택 근거, WebRTC vs HLS, MQTT metadata, VLM 확장, Self-Improving AI, Synthetic Data, 배포 구성요소, Mermaid 관련 문서화, LSTM feature vector, frame sync/overlay matching 질문을 포함한다.

## 한계와 후속 작업

- 현재 vector store는 JSON 파일 기반이므로 대용량 문서나 동시 reindex 워크로드에는 적합하지 않다.
- local hash embedding은 무료/저비용이라는 장점이 있지만, 전문 embedding model보다 의미 검색 품질이 낮을 수 있다.
- code fence가 chunk에서 제거되므로 Mermaid 코드나 JSON payload 내부 세부 필드 검색은 별도 전략이 필요할 수 있다.
- 외부 LLM 사용 시 provider별 rate limit, timeout, 비용 정책은 운영 환경에서 별도 모니터링이 필요하다.
- 관리자 UI에서 문서 저장과 동시에 `npm run rag:index`에 해당하는 reindex 작업을 트리거하는 기능은 아직 서버 API로 열려 있지 않다.
