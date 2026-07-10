# Retrieval Eval Report

## Manifest
- runId: 20260710-141242579_b5f11c2_baseline-legacy-chunking
- experiment: baseline-legacy-chunking
- retrievalMode: baseline
- git: main@b5f11c2 dirty=true
- dataset: golden_queries.v1
- docs/chunks: 39/513
- embedding: local-hash-tfidf dim=256

## Metrics (search only)
| Metric | Value |
| --- | ---: |
| Hit@1 | 0.52 |
| Hit@3 | 0.6 |
| Hit@5 | 0.62 |
| Recall@5 | 0.4467 |
| MRR | 0.5617 |
| nDCG@5 | 0.4572 |
| Metadata Filter Accuracy | 0 |
| No-result Accuracy | 0 |
| Duplicate count | 166 |
| p50 latency ms | 0.8249 |
| p95 latency ms | 1.4738 |
| mean retrieved chunks | 5 |

LLM answer metrics were not evaluated in this run (evaluateAnswer=false).

## Promotion
- promote: false
- reasons: n/a
- regressions: no quality gain: recallΔ=0.0000 mrrΔ=0.0000 < 0.01

## Failure taxonomy
- DUPLICATE_RESULT: 50
- EXPECTED_DOC_NOT_RETRIEVED: 19
- SEMANTIC_MISS: 19
- KEYWORD_MISS: 9
- WRONG_TOP1: 5
- NO_ANSWER_FAILURE: 5
- FILTER_FAILURE: 3
- LOW_SIMILARITY: 0
- STALE_DOCUMENT_SELECTED: 0

## Sample failures
- q-001 [DUPLICATE_RESULT] duplicates=1
- q-002 [DUPLICATE_RESULT] duplicates=4
- q-003 [EXPECTED_DOC_NOT_RETRIEVED] expected one of MQTT-Event-Schema, ADR-002-MQTT-Metadata-Separation, AI-Pipeline
- q-003 [KEYWORD_MISS] keywordHitRate=0
- q-003 [SEMANTIC_MISS] vector returned unrelated high scores
- q-003 [DUPLICATE_RESULT] duplicates=3
- q-004 [EXPECTED_DOC_NOT_RETRIEVED] expected one of ADR-001-WebRTC, WebRTC-vs-HLS, Architecture
- q-004 [KEYWORD_MISS] keywordHitRate=0
- q-004 [SEMANTIC_MISS] vector returned unrelated high scores
- q-004 [DUPLICATE_RESULT] duplicates=3
- q-005 [EXPECTED_DOC_NOT_RETRIEVED] expected one of 2026-07-02-AI-BBox54-HardNegative-Overlay-Debug-Log, Feature-Vector-51D-vs-54D, ADR-004-LSTM-Feature-Expansion
- q-005 [SEMANTIC_MISS] vector returned unrelated high scores
- q-005 [DUPLICATE_RESULT] duplicates=4
- q-006 [EXPECTED_DOC_NOT_RETRIEVED] expected one of 2026-06-30-Overlay-Tracking-Evidence-Log, Bug-AI-Tracker-FrameRate-Mismatch, Evidence-TensorRT-Adoption-Decision
- q-006 [SEMANTIC_MISS] vector returned unrelated high scores
