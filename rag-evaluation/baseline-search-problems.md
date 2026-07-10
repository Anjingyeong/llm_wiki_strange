# Baseline Vector Search — 문제 분석 (측정 기반)

> 기준 run: `baseline-vector-search` on pure vector mode (`searchRelevantChunks(..., { mode: 'baseline' })`)  
> Dataset: `golden_queries.v1` (55 queries)  
> Embedding: local-hash-tfidf, dim=256  
> **운영 hybrid 검색/인덱스는 변경하지 않음.**

## Baseline 지표 (재현 확인)

동일 commit에서 2회 평가 시 품질 지표 일치:

| Metric | Value |
| --- | ---: |
| Hit@1 | 0.52 |
| Hit@5 | 0.62 |
| Recall@5 | 0.4467 |
| MRR | 0.5617 |
| nDCG@5 | 0.4572 |
| No-result Accuracy | **0.00** |
| Duplicate count (chunk-level) | 50 queries affected |
| p95 latency | ~1–3 ms (local, machine-dependent) |

## 실패 유형 건수 (대표 run)

| Code | Count | 해석 |
| --- | ---: | --- |
| DUPLICATE_RESULT | 50 | top-K에 동일 document의 여러 chunk 중복 |
| EXPECTED_DOC_NOT_RETRIEVED | 19 | 정답 slug가 top-K 문서 집합에 없음 |
| SEMANTIC_MISS | 19 | 점수는 나왔으나 정답 문서 미포함 |
| KEYWORD_MISS | 9 | 기대 키워드가 반환 chunk 텍스트에 거의 없음 |
| WRONG_TOP1 | 5 | 정답은 top5에 있으나 top1 오답 |
| NO_ANSWER_FAILURE | (unanswerable 전부) | 미지원 질의에도 chunk 반환 |
| FILTER_FAILURE / STALE / LOW_SIMILARITY | 0~낮음 | 이번 세트에서 주 실패 아님 |

## 가장 큰 검색 문제 5개

1. **Chunk 중복 (diversify 부재 in pure vector)**  
   baseline 경로는 `diversifyResults`를 쓰지 않아 같은 문서 chunk가 top-K를 점유 → Hit@K 문서 다양성 저하.

2. **Hash embedding의 의미 한계 (256-d local-hash)**  
   패러프레이즈·결정 근거·다중 문서 질의에서 SEMANTIC_MISS / EXPECTED_DOC_NOT_RETRIEVED 다수. exact token 질의는 상대적으로 낫지만 자연어는 취약.

3. **No-result 미지원**  
   MIN_SCORE=0.03 필터만으로 “관련 없음”을 거르지 못함. unanswerable 질의 No-result Accuracy=0.

4. **Exact term vs semantic 혼재**  
   파일명·기술 토큰 질의는 keyword path(hybrid)가 유리할 가능성이 큼. baseline pure vector는 exact term 이점을 의도적으로 제거한 상태라 hybrid 대비 불리할 수 있음(비교는 다음 단계).

5. **Top1 오류**  
   정답이 하위에 있어도 첫 문서가 틀리는 케이스(WRONG_TOP1=5) → rerank 후보.

## 원인 분해 (가설 → 다음 실험)

| 가설 | 근거 | 다음 단계 |
| --- | --- | --- |
| Chunking | 섹션/테이블 분할로 핵심 문장이 분산 | 청크 경계·제목 가중 실험 |
| Embedding | local hash 256-d, 의미 유사도 약함 | 더 나은 embed model candidate (승격 정책 적용) |
| Metadata filter | baseline도 infer filter 사용하나 pure vector 점수 지배 | filter strictness 실험 |
| Threshold | MIN_SCORE 0.03이 no-result 실패 유발 | dynamic threshold / empty guard |
| Exact term | pure vector only | BM25 hybrid candidate 비교 |
| Diversity | baseline에 diversify 없음 | MMR/doc diversify candidate |

## 다음 단계에서 먼저 개선할 요소 (우선순위)

1. **Document-level diversify** on retrieval (duplicate 제거) — 저위험, Hit@K 즉시 영향 가능  
2. **Hybrid BM25+vector (기존 hybrid mode)** 를 동일 golden set으로 candidate 평가  
3. **No-result / min-score calibration**  
4. Embedding 교체는 승격 정책 통과 시에만 운영 인덱스 반영  

## 원칙 준수

- 운영 `data/ragVectorIndex.json` / hybrid 기본 경로는 평가 harness가 교체하지 않음  
- 검색 평가와 LLM 답변 평가 분리 (`evaluateAnswer: false`)  
- 실패 run도 `rag-evaluation/runs/`에 보존  
- 성능 개선 표현은 측정값 있을 때만 사용
