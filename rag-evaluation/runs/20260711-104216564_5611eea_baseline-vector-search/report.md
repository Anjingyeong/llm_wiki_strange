# Retrieval Eval Report

## Manifest
- runId: 20260711-104216564_5611eea_baseline-vector-search
- experiment: baseline-vector-search
- retrievalMode: baseline
- git: main@5611eea dirty=true
- dataset: golden_queries.v1
- docs/chunks: 46/717
- embedding: local-hash-tfidf dim=256

## Metrics (search only)
| Metric | Value |
| --- | ---: |
| Hit@1 | 0.5 |
| Hit@3 | 0.68 |
| Hit@5 | 0.72 |
| Recall@5 | 0.5 |
| MRR | 0.5923 |
| nDCG@5 | 0.4917 |
| Metadata Filter Accuracy | 0 |
| No-result Accuracy | 0 |
| Duplicate count | 142 |
| p50 latency ms | 1.1116 |
| p95 latency ms | 5.0431 |
| mean retrieved chunks | 5 |

LLM answer metrics were not evaluated in this run (evaluateAnswer=false).

## Promotion
- promote: false
- reasons: n/a
- regressions: no quality gain: recallΔ=-0.0367 mrrΔ=-0.0533 < 0.01; hitAt1 regressed by 0.0600 > 0.02; hitAt3 regressed by 0.0600 > 0.02; hitAt5 regressed by 0.0600 > 0.02; recallAt5 regressed by 0.0367 > 0.02; mrr regressed by 0.0533 > 0.02; ndcgAt5 regressed by 0.0364 > 0.02; duplicates increased 136 -> 142

## Failure taxonomy
- DUPLICATE_RESULT: 46
- EXPECTED_DOC_NOT_RETRIEVED: 14
- SEMANTIC_MISS: 14
- WRONG_TOP1: 11
- KEYWORD_MISS: 8
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
- q-008 [WRONG_TOP1] top1=ED-Fall-Faint-Lifecycle
- q-008 [DUPLICATE_RESULT] duplicates=3
- q-009 [EXPECTED_DOC_NOT_RETRIEVED] expected one of Architecture, Overview, Glossary
- q-009 [KEYWORD_MISS] keywordHitRate=0
- q-009 [SEMANTIC_MISS] vector returned unrelated high scores
