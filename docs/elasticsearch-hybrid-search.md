# Elasticsearch 하이브리드 검색 연동

스마트안전관제 LLM Wiki의 `/api/rag/ask` 질문 API에 Elasticsearch BM25 + dense_vector KNN 결과를 RRF(Reciprocal Rank Fusion)로 결합한 하이브리드 검색을 연결합니다.

## 아키텍처

```
사용자 질문
    │
    ▼
/api/rag/ask (server.mjs)
    │
    ▼
searchRagChunks (search-retriever.mjs)
    │
    ├─ [elastic mode] ──► Elasticsearch BM25 + KNN → RRF Top-K
    │                         │
    │                         ▼
    │                    검색 결과 정규화
    │
    ├─ [static mode] ──► 기존 ragVectorIndex.json 인메모리 검색
    │
    └─ [auto mode] ────► Elasticsearch 우선, 실패 시 static fallback
                              │
                              ▼
                    answerQuestionFromIndex → LLM Context → 근거 답변
```

### BM25 + KNN + RRF

- **BM25**: 키워드 매칭. `codeSymbols^6, title^5, displayTitle^4, tags^3, entities^3, headingPath^2.5, sectionTitle^2.5, summary^1.5, content` 순 가중치.
- **KNN**: 256차원 해시 기반 벡터로 dense_vector cosine 유사도 검색.
- **RRF**: 두 채널 결과를 `1/(k + rank + 1)` 공식으로 결합. 양쪽에 모두 등장한 문서가 상위로 올라감.

> ⚠️ 현재 벡터는 실제 임베딩 모델이 아닌 해시 기반 256차원 벡터입니다. BM25 키워드 매칭이 주 검색력이며, KNN은 보조 채널입니다.

### Fallback 동작

| RAG_RETRIEVER | Elasticsearch 정상 | Elasticsearch 장애 |
|---|---|---|
| `elastic` | ES 사용 | 오류 반환 |
| `static` | 정적 검색 | 정적 검색 |
| `auto` (기본) | ES 사용 | 정적 검색 fallback |

## 실행법

### 1. 의존성 설치

```bash
npm install
```

### 2. 인덱스 생성

```bash
npm run generate:index
```

### 3. Elasticsearch 실행

```bash
npm run elastic:up
```

Docker Compose로 Elasticsearch 8.17 단일 노드가 `localhost:9200`에 기동됩니다.

### 4. Elasticsearch 색인

```bash
npm run elastic:index
```

출력 예시:
```json
{
  "health": "green",
  "index": "llm-wiki-chunks-v1",
  "sourceDocumentCount": 52,
  "sourceChunkCount": 696,
  "indexedChunkCount": 696,
  "indexed": 696
}
```

### 5. 개발 서버 실행

```bash
npm run dev
```

또는 프로덕션 모드:
```bash
npm run build
npm start
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `RAG_RETRIEVER` | `auto` | 검색 모드: `auto`, `elastic`, `static` |
| `ELASTIC_URL` | `http://localhost:9200` | Elasticsearch URL |
| `ELASTIC_INDEX` | `smart-safety-wiki` | 검색 인덱스명 |
| `ELASTIC_USERNAME` | (빈 값) | Basic Auth 사용자명 |
| `ELASTIC_PASSWORD` | (빈 값) | Basic Auth 비밀번호 |
| `ELASTIC_API_KEY` | (빈 값) | API Key 인증 |

기존 `ELASTICSEARCH_URL` / `ELASTICSEARCH_INDEX` 환경 변수도 호환됩니다.

## API

### POST /api/rag/ask

요청:
```json
{ "question": "VIDEO_EOF 발생 시 어떻게 처리하는가?" }
```

응답 (기존 필드 + 추가 메타데이터):
```json
{
  "status": "answered",
  "answer": "...",
  "sources": [...],
  "retrievalMode": "elastic",
  "fallbackUsed": false,
  "retrievalLatencyMs": 42,
  "retrievalSources": [
    {
      "id": "chunk-id",
      "documentId": "Multi-Camera-Worker-Session-Reliability",
      "slug": "Multi-Camera-Worker-Session-Reliability",
      "title": "다중 카메라 워커 세션 신뢰성",
      "section": "VIDEO_EOF 처리",
      "category": "architecture",
      "implementationStatus": "verified",
      "score": 0.032,
      "matchedBy": ["elastic-bm25", "elastic-knn", "elastic-rrf"],
      "codeSymbols": ["VIDEO_EOF", "reset_analysis_session"]
    }
  ]
}
```

### GET /api/rag/status

```json
{
  "retriever": "auto",
  "elasticsearch": {
    "configured": true,
    "available": true,
    "status": "green",
    "index": "smart-safety-wiki",
    "documentCount": 696
  },
  "staticFallback": {
    "available": true
  }
}
```

민감정보(URL, 인증, 상세 오류)는 브라우저에 노출하지 않습니다.

## 테스트

```bash
npm test
```

테스트 항목:
- RRF 결합: 두 채널 결과의 순위 융합
- Elasticsearch 결과 정규화
- 필터 화이트리스트 (허용: category, tags, implementationStatus, documentId, slug)
- retrievalMode 반환 검증
- Elasticsearch 장애 시 static fallback
- sources 메타데이터 포함 검증
- 민감정보(패스워드, API키, 내부 URL) 비노출

실제 Elasticsearch 없이 mock으로 테스트 가능합니다.

## 예시 질문

| 질문 | 기대 검색 대상 |
|---|---|
| WebRTC에서 MJPEG로 롤백한 이유는? | MJPEG-Streaming-Rollback-Report |
| VIDEO_EOF 발생 시 어떻게 처리하는가? | Multi-Camera-Worker-Session-Reliability |
| track_lost_grace_sec는 무엇을 해결하는가? | Tracking-Association-Stabilization |
| frame_sync를 추가한 이유는? | Frame-Sync-Canonical |
| TensorRT 적용 전후 성능 차이는? | Evidence-TensorRT-Adoption-Decision |
| NVENC 종료 코드 255 대응은? | Realtime-Camera-Runtime-Stabilization |

## 제한사항

- 벡터는 해시 기반 256차원이며 실제 시맨틱 임베딩이 아닙니다.
- 실제 임베딩 모델이나 유료 API를 사용하지 않습니다.
- 단일 노드 Elasticsearch만 지원합니다.
- 증분 색인, Alias 무중단 재색인은 미구현입니다.
- CCTV 이벤트 저장, SIEM, Logstash, Filebeat, Kibana 연동은 범위 외입니다.

## 변경 파일

| 파일 | 역할 |
|---|---|
| `scripts/lib/rag/search-retriever.mjs` | 검색기 추상화 (searchRagChunks, fallback, 필터) |
| `server.mjs` | API 연동, /api/rag/status, 메타데이터 응답 |
| `src/components/wikiAskResponse.ts` | 프론트엔드 타입 확장 |
| `src/components/WikiAskWorkspace.tsx` | 검색 메타데이터 UI |
| `src/styles.css` | 메타데이터 스타일 |
| `tests/search-retriever.test.mjs` | 통합 테스트 |
| `.env.example` | 환경 변수 문서화 |
| `package.json` | 테스트 스크립트 수정 |
| `docs/elasticsearch-hybrid-search.md` | 이 README |
