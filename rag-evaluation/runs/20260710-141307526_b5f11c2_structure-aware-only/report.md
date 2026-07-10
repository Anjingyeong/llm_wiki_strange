# Retrieval Eval Report

## Manifest
- runId: 20260710-141307526_b5f11c2_structure-aware-only
- experiment: structure-aware-only
- retrievalMode: baseline
- git: main@b5f11c2 dirty=true
- dataset: golden_queries.v1
- docs/chunks: 39/585
- embedding: local-hash-tfidf dim=256

## Metrics (search only)
| Metric | Value |
| --- | ---: |
| Hit@1 | 0.56 |
| Hit@3 | 0.74 |
| Hit@5 | 0.78 |
| Recall@5 | 0.5267 |
| MRR | 0.6457 |
| nDCG@5 | 0.5219 |
| Metadata Filter Accuracy | 0 |
| No-result Accuracy | 0 |
| Duplicate count | 140 |
| p50 latency ms | 1.0268 |
| p95 latency ms | 1.7649 |
| mean retrieved chunks | 5 |

LLM answer metrics were not evaluated in this run (evaluateAnswer=false).

## Promotion
- promote: false
- reasons: quality gain recallΔ=0.0800 mrrΔ=0.0840
- regressions: p95 latency increased by 58.6% > 30%

## Failure taxonomy
- DUPLICATE_RESULT: 46
- EXPECTED_DOC_NOT_RETRIEVED: 11
- WRONG_TOP1: 11
- SEMANTIC_MISS: 11
- KEYWORD_MISS: 6
- NO_ANSWER_FAILURE: 5
- FILTER_FAILURE: 3
- LOW_SIMILARITY: 0
- STALE_DOCUMENT_SELECTED: 0

## Sample failures
- q-001 [DUPLICATE_RESULT] duplicates=1
- q-002 [DUPLICATE_RESULT] duplicates=3
- q-003 [DUPLICATE_RESULT] duplicates=2
- q-004 [WRONG_TOP1] top1=Frame-Sync-Debug-Report
- q-004 [DUPLICATE_RESULT] duplicates=1
- q-005 [EXPECTED_DOC_NOT_RETRIEVED] expected one of 2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log, Feature-Vector-51D-vs-54D, ADR-004-LSTM-Feature-Expansion
- q-005 [SEMANTIC_MISS] vector returned unrelated high scores
- q-005 [DUPLICATE_RESULT] duplicates=4
- q-006 [WRONG_TOP1] top1=AI-Output-JSON
- q-007 [DUPLICATE_RESULT] duplicates=4
- q-008 [DUPLICATE_RESULT] duplicates=3
- q-009 [EXPECTED_DOC_NOT_RETRIEVED] expected one of Architecture, Overview, Glossary
- q-009 [KEYWORD_MISS] keywordHitRate=0
- q-009 [SEMANTIC_MISS] vector returned unrelated high scores
- q-009 [DUPLICATE_RESULT] duplicates=1
