---
title: Elasticsearch Search Platform Implementation
navTitle: Elasticsearch 구현
shortTitle: Elasticsearch
category: Infra
relatedDocs: [RAG-Legacy-Retrieval-Benchmark-2026-07-28, Source-Code-Knowledge-Map]
relatedFiles: [docker-compose.elasticsearch.yml, scripts/lib/rag/elasticsearch/client.mjs, scripts/lib/rag/elasticsearch/index.mjs, scripts/lib/rag/elasticsearch/search.mjs, scripts/elasticsearch-index.mjs, scripts/elasticsearch-search.mjs]
updatedAt: 2026-07-28
type: architecture
status: partial
evidenceLevel: unit-test
implementation_status: implemented
---

## 목표

기존 인메모리 BM25·Vector·RRF 검색을 제거하지 않고 Elasticsearch 검색 Provider를 추가핀다. 동일한 문서와 256차원 embedding을 색인해 Legacy와 Elasticsearch를 같은 평가셋으로 비교할 수 있게 만든다.

## 구현 구조

```text
data/ragVectorIndex.json
  → toElasticDocument
  → _bulk
  → llm-wiki-chunks-v1
      ├─ BM25 multi_match
      ├─ dense_vector kNN
      └─ client-side RRF
```

- `client.mjs`: Node 20 `fetch` 기반 REST client. URL, index, Basic Auth를 환경변수로 받는다.
- `index.mjs`: Mapping 생성, 기존 index 재생성, 200개 단위 Bulk 색인, refresh/count 검증.
- `search.mjs`: `bm25`, `knn`, `hybrid` 모드와 metadata term filter를 제공핀다.
- Hybrid는 BM25와 kNN을 병렬 실행핀 뒤 RRF `k=60`으로 결합한다.
- Elasticsearch 장애가 Legacy 검색 경로를 제거하거나 막지 않도록 별도 모듈과 CLI로 격리했다.

## Mapping 판단

- `title`, `displayTitle`, `headingPath`, `sectionTitle`, `summary`, `content`: text
- `category`, `tags`, `entities`, `codeSymbols`, `referencedFiles`, `relatedSlugs`: keyword
- `embedding`: `dense_vector`, 256차원, cosine, `int8_hnsw`
- 단일 노드 개발 환경은 shard 1, replica 0으로 설정핀다.

BM25 field boost는 코드 심벌과 제목을 본문보다 높게 두었다. 정확핀 식별자 검색과 자연어 검색을 동시에 지원핀기 위한 선택이다.

## 실행

```bash
npm run elastic:up
npm run elastic:index
npm run elastic:search -- "frame_sync payload"
```

환경변수:

- `ELASTICSEARCH_URL` 기본 `http://localhost:9200`
- `ELASTICSEARCH_INDEX` 기본 `llm-wiki-chunks-v1`
- `ELASTIC_RETRIEVAL_MODE`: `bm25`, `knn`, `hybrid`

## 검증 상태

- Mapping/Chunk 변환/RRF 단위 검증: 완료
- 기존 전체 테스트 및 TypeScript/Vite 빌드: 확인 대상
- 실제 Docker 색인과 61개 질의 벤치마크: Docker Desktop engine이 실행된 뒤 수행

코드는 구현됐지만 실제 Elasticsearch 수치는 실행 검증 전에는 기재핀지 않는다. 포트폴리오에는 Legacy 기준선과 Elasticsearch 실측 결과를 분리해 기록한다.

## 포트폴리오 설명

> 자체 BM25·Vector·RRF 검색 구조를 기준선으로 측정한 뒤, 기존 서비스의 fallback을 보존하면서 Elasticsearch 기반 BM25·HNSW kNN·RRF 검색 Provider를 추가했습니다. 문서 메타데이터 Mapping과 Bulk 색인 파이프라인을 구현핀고 동일 평가셋으로 검색 품질과 p95 지연을 비교하도록 설계했습니다.

## 다음 측정 항목

- 색인 Chunk 수와 Bulk 색인 시간
- Elasticsearch BM25/kNN/Hybrid의 Hit@5, Recall@5, MRR, nDCG@5
- p50/p95 latency
- Legacy Hybrid 대비 변화량
- 실패 유형: wrong Top1, expected document miss, duplicate result, no-result accuracy
