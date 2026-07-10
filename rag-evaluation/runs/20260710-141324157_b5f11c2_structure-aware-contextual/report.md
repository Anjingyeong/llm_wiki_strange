# Retrieval Eval Report

## Manifest
- runId: 20260710-141324157_b5f11c2_structure-aware-contextual
- experiment: structure-aware-contextual
- retrievalMode: baseline
- git: main@b5f11c2 dirty=true
- dataset: golden_queries.v1
- docs/chunks: 39/585
- embedding: local-hash-tfidf dim=256

## Metrics (search only)
| Metric | Value |
| --- | ---: |
| Hit@1 | 0.54 |
| Hit@3 | 0.74 |
| Hit@5 | 0.74 |
| Recall@5 | 0.4767 |
| MRR | 0.6267 |
| nDCG@5 | 0.4859 |
| Metadata Filter Accuracy | 0 |
| No-result Accuracy | 0 |
| Duplicate count | 158 |
| p50 latency ms | 0.6653 |
| p95 latency ms | 1.2366 |
| mean retrieved chunks | 5 |

LLM answer metrics were not evaluated in this run (evaluateAnswer=false).

## Promotion
- promote: true
- reasons: quality gain recallΔ=0.0300 mrrΔ=0.0650
- regressions: none

## Failure taxonomy
- DUPLICATE_RESULT: 49
- EXPECTED_DOC_NOT_RETRIEVED: 13
- SEMANTIC_MISS: 13
- WRONG_TOP1: 10
- KEYWORD_MISS: 5
- NO_ANSWER_FAILURE: 5
- FILTER_FAILURE: 3
- STALE_DOCUMENT_SELECTED: 2
- LOW_SIMILARITY: 0

## Sample failures
- q-001 [DUPLICATE_RESULT] duplicates=1
- q-002 [DUPLICATE_RESULT] duplicates=3
- q-003 [WRONG_TOP1] top1=LSTM-Experiment-Results
- q-003 [DUPLICATE_RESULT] duplicates=3
- q-004 [WRONG_TOP1] top1=Frame-Sync-Debug-Report
- q-004 [DUPLICATE_RESULT] duplicates=2
- q-005 [EXPECTED_DOC_NOT_RETRIEVED] expected one of 2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log, Feature-Vector-51D-vs-54D, ADR-004-LSTM-Feature-Expansion
- q-005 [SEMANTIC_MISS] vector returned unrelated high scores
- q-005 [DUPLICATE_RESULT] duplicates=4
- q-006 [STALE_DOCUMENT_SELECTED] top1=Bug-AI-Tracker-FrameRate-Mismatch missing newer=2026-06-30-Overlay-Tracking-Evidence-Log
- q-007 [DUPLICATE_RESULT] duplicates=4
- q-008 [DUPLICATE_RESULT] duplicates=4
- q-009 [EXPECTED_DOC_NOT_RETRIEVED] expected one of Architecture, Overview, Glossary
- q-009 [KEYWORD_MISS] keywordHitRate=0
- q-009 [SEMANTIC_MISS] vector returned unrelated high scores
