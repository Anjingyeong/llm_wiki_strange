---
title: RAG Legacy Retrieval Benchmark 2026-07-28
navTitle: Legacy Search Benchmark
shortTitle: Search Benchmark
category: Experiments
relatedDocs: [Source-Code-Knowledge-Map, Code-Symbol-Index-Notes]
updatedAt: 2026-07-28
implementation_status: implemented
---

## 목적

Elasticsearch 도입 전 메모리 기반 Vector, BM25, Hybrid 검색을 동일 조건에서 측정해 기준선으로 고정한다.

## 평가 조건

- commit: `1befcbc` (`fix/wiki-readability-search`, dirty)
- Node.js/OS: `v20.20.2` / Windows
- `golden_queries.v1`: 61개(답변 가능 56, 답변 불가 5)
- Top-K 5, 문서 48개, Chunk 721개
- `local-hash-tfidf` 256차원, `section-blocks-v1`
- Retrieval-only 평가

## 측정 결과

| 지표 | Vector | BM25 | Hybrid |
|---|---:|---:|---:|
| Hit@1 | 48.21% | 55.36% | **60.71%** |
| Hit@3 | 66.07% | 71.43% | **78.57%** |
| Hit@5 | 69.64% | 75.00% | **82.14%** |
| Recall@5 | 46.13% | 50.00% | **61.01%** |
| MRR@5 | 0.5696 | 0.6369 | **0.6875** |
| nDCG@5 | 0.4618 | 0.4977 | **0.5884** |
| No-result Accuracy | 0% | 40% | **100%** |
| p50 | **0.90ms** | 95.95ms | 138.49ms |
| p95 | **2.45ms** | 127.73ms | 171.89ms |

Hybrid는 Vector 대비 Hit@5 `+12.50%p`, Recall@5 `+14.88%p`, MRR `+0.1179`를 기록했다. BM25 대비 Hit@5 `+7.14%p`, Recall@5 `+11.01%p`, MRR `+0.0506`이다.

## 실패 유형

| 실패 | Vector | BM25 | Hybrid |
|---|---:|---:|---:|
| Expected doc miss | 17 | 14 | **10** |
| Wrong Top-1 | 12 | **11** | 12 |
| Keyword miss | 11 | 3 | **0** |
| Semantic miss | 17 | 14 | **0** |
| No-answer failure | 5 | 3 | **0** |
| Filter failure | 3 | 3 | 3 |
| Stale doc | 1 | 1 | **0** |

Hybrid는 품질이 가장 높지만 p95 171.89ms다. 현재 BM25가 애플리케이션 메모리에서 전체 Chunk를 계산하고 Hybrid가 BM25·Vector·RRF를 모두 수행하기 때문이다.

## 한계와 다음 단계

현재 corpus는 작고 각 모드는 1회 실행했으며 임베딩은 hash-TFIDF다. Working tree가 dirty이므로 재현 시 Run manifest와 corpus hash를 함께 확인한다. LLM 답변 충실도·인용 정확도·비용은 포함하지 않았다.

Elasticsearch 구현 후 동일 평가셋으로 `elastic-bm25`, `elastic-knn`, `elastic-hybrid-rrf`를 비교한다. 승격 기준은 Recall@5, MRR, No-result Accuracy, Wrong Top-1, Filter Failure, p95 latency다.
