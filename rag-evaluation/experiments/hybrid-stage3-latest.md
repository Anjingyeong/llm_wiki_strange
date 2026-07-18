# Stage-3 Hybrid Search Experiment Report

- runId: `20260718-105710459_b51ba68_hybrid-stage3`
- Stage-2 anchor: **baseline-vector-search** (structure-aware vector-only)
- Selected RRF: k=60, lex=1, vec=1
- Promotion: **true** hybrid-contextual-diversify-max2
- Note: best.json and retrieval-config updated; index pointer updated only if contextual index required.

## 1. Stage-2 baseline
| Metric | Value |
| --- | ---: |
| Hit@5 | 0.78 |
| Recall@5 | 0.5367 |
| MRR | 0.6457 |
| nDCG@5 | 0.528 |
| DUPLICATE_RESULT | 46 |
| WRONG_TOP1 | 11 |
| KEYWORD_MISS | 7 |
| SEMANTIC_MISS | 11 |
| EXPECTED_DOC_NOT_RETRIEVED | 11 |

### Stage-2 failure samples

## 2. Candidate overall metrics
| Candidate | Hit@1 | Hit@5 | Recall@5 | MRR | nDCG@5 | Exact Hit@5 | Sem Recall@5 | Dup | WrongTop1 | NoRes | p95 | Overlap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| vector-only-structure-aware | 0.5179 | 0.625 | 0.4167 | 0.558 | 0.427 | 0.7273 | 0.3952 | 164 | 6 | 0 | 1.0541 | 0 |
| lexical-only | 0.4643 | 0.625 | 0.3988 | 0.5417 | 0.4033 | 0.6364 | 0.3905 | 167 | 9 | 0.4 | 148.1855 | 0 |
| hybrid-rrf | 0.5714 | 0.6429 | 0.4107 | 0.6071 | 0.4456 | 0.8182 | 0.3714 | 161 | 4 | 1 | 148.2192 | 0.3734 |
| hybrid-diversify-max1 | 0.5714 | 0.75 | 0.5238 | 0.6435 | 0.5143 | 0.8182 | 0.5381 | 0 | 10 | 1 | 136.8777 | 0.3734 |
| hybrid-diversify-max2 | 0.5714 | 0.7143 | 0.4792 | 0.6354 | 0.4922 | 0.8182 | 0.481 | 94 | 8 | 1 | 151.0276 | 0.3734 |
| hybrid-contextual | 0.6071 | 0.7321 | 0.4881 | 0.6622 | 0.5075 | 0.9091 | 0.4714 | 158 | 7 | 1 | 133.5529 | 0.3737 |
| hybrid-contextual-diversify-max2 | 0.6071 | 0.8036 | 0.5774 | 0.6875 | 0.5701 | 1 | 0.5381 | 91 | 11 | 1 | 148.0411 | 0.3737 |

## 3. Per query-type (Hit@5 / Recall@5)
### vector-only-structure-aware
- exact-term: Hit@5=0.7273 Recall@5=0.5152 MRR=0.6818 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.4 Recall@5=0.2444 MRR=0.3056 WrongTop1=2 (n=15)
- decision: Hit@5=0.8333 Recall@5=0.5833 MRR=0.6389 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.3333 MRR=0.7619 WrongTop1=1 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=0.75 Recall@5=0.4583 MRR=0.75 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=0.7143 Recall@5=0.619 MRR=0.7143 WrongTop1=0 (n=7)
### lexical-only
- exact-term: Hit@5=0.6364 Recall@5=0.4848 MRR=0.5455 WrongTop1=2 (n=11)
- paraphrase: Hit@5=0.7333 Recall@5=0.4111 MRR=0.6222 WrongTop1=3 (n=15)
- decision: Hit@5=0.5 Recall@5=0.25 MRR=0.5 WrongTop1=0 (n=6)
- multi-doc: Hit@5=0.7143 Recall@5=0.2381 MRR=0.6429 WrongTop1=1 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.25 WrongTop1=1 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=0.5 Recall@5=0.3333 MRR=0.375 WrongTop1=1 (n=4)
- mixed-lang: Hit@5=0.7143 Recall@5=0.619 MRR=0.6429 WrongTop1=1 (n=7)
### hybrid-rrf
- exact-term: Hit@5=0.8182 Recall@5=0.5303 MRR=0.7727 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.5333 Recall@5=0.3 MRR=0.5333 WrongTop1=0 (n=15)
- decision: Hit@5=0.6667 Recall@5=0.4167 MRR=0.5833 WrongTop1=1 (n=6)
- multi-doc: Hit@5=0.7143 Recall@5=0.2381 MRR=0.6429 WrongTop1=1 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=0.75 Recall@5=0.5417 MRR=0.625 WrongTop1=1 (n=4)
- mixed-lang: Hit@5=0.7143 Recall@5=0.619 MRR=0.7143 WrongTop1=0 (n=7)
### hybrid-diversify-max1
- exact-term: Hit@5=0.8182 Recall@5=0.5758 MRR=0.7727 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.7333 Recall@5=0.4444 MRR=0.5967 WrongTop1=3 (n=15)
- decision: Hit@5=0.8333 Recall@5=0.5833 MRR=0.6667 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.4286 MRR=0.6905 WrongTop1=2 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=0.75 Recall@5=0.5417 MRR=0.625 WrongTop1=1 (n=4)
- mixed-lang: Hit@5=0.8571 Recall@5=0.8095 MRR=0.75 WrongTop1=1 (n=7)
### hybrid-diversify-max2
- exact-term: Hit@5=0.8182 Recall@5=0.5303 MRR=0.7727 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.6667 Recall@5=0.4222 MRR=0.5833 WrongTop1=2 (n=15)
- decision: Hit@5=0.8333 Recall@5=0.5833 MRR=0.6667 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.3333 MRR=0.6905 WrongTop1=2 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=0.75 Recall@5=0.5417 MRR=0.625 WrongTop1=1 (n=4)
- mixed-lang: Hit@5=0.7143 Recall@5=0.6667 MRR=0.7143 WrongTop1=0 (n=7)
### hybrid-contextual
- exact-term: Hit@5=0.9091 Recall@5=0.5758 MRR=0.8636 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.4667 Recall@5=0.2778 MRR=0.35 WrongTop1=3 (n=15)
- decision: Hit@5=1 Recall@5=0.75 MRR=0.8333 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.3333 MRR=0.7619 WrongTop1=1 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.625 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=0.8571 Recall@5=0.7857 MRR=0.8571 WrongTop1=0 (n=7)
### hybrid-contextual-diversify-max2
- exact-term: Hit@5=1 Recall@5=0.6364 MRR=0.8939 WrongTop1=2 (n=11)
- paraphrase: Hit@5=0.5333 Recall@5=0.3444 MRR=0.3667 WrongTop1=4 (n=15)
- decision: Hit@5=1 Recall@5=0.75 MRR=0.8333 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.4762 MRR=0.7619 WrongTop1=1 (n=7)
- filter: Hit@5=0.5 Recall@5=0.5 MRR=0.4167 WrongTop1=1 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.875 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=1 Recall@5=0.8333 MRR=0.9048 WrongTop1=1 (n=7)

## 4. Vector-only vs Hybrid deltas
- Hit@5 Δ: 0.0179
- Recall@5 Δ: -0.006
- MRR Δ: 0.0491
- Dup Δ: -3
- WrongTop1 Δ: -2

## 5. Document diversification effect
- hybrid-rrf: Hit@5=0.6429 Recall@5=0.4107 Dup=161 WrongTop1=4
- hybrid-diversify-max1: Hit@5=0.75 Recall@5=0.5238 Dup=0 WrongTop1=10
- hybrid-diversify-max2: Hit@5=0.7143 Recall@5=0.4792 Dup=94 WrongTop1=8

## 6. Contextual prefix + hybrid
- hybrid-contextual: Hit@5=0.7321 ExactHit@5=0.9091 Recall@5=0.4881 MRR=0.6622
- hybrid-contextual-diversify-max2: Hit@5=0.8036 ExactHit@5=1 Recall@5=0.5774 MRR=0.6875

## 7. Most improved queries (sample)
- q-005 [hybrid-contextual]: 0→1 — keypoint_bbox54
- q-005 [hybrid-contextual-diversify-max2]: 0→1 — keypoint_bbox54
- q-006 [lexical-only]: 0→1 — ByteTrack track_id
- q-006 [hybrid-rrf]: 0→1 — ByteTrack track_id
- q-006 [hybrid-diversify-max1]: 0→1 — ByteTrack track_id
- q-006 [hybrid-diversify-max2]: 0→1 — ByteTrack track_id
- q-006 [hybrid-contextual]: 0→1 — ByteTrack track_id
- q-006 [hybrid-contextual-diversify-max2]: 0→1 — ByteTrack track_id
- q-010 [lexical-only]: 0→1 — 실시간 관제 화면에서 왜 WebRTC를 기본으로 쓰나요
- q-010 [hybrid-diversify-max1]: 0→1 — 실시간 관제 화면에서 왜 WebRTC를 기본으로 쓰나요

## 8. Worsened queries (sample)
- q-001 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,SEMANTIC_MISS,DUPLICATE_RESULT — cameraLoginId
- q-001 [hybrid-contextual]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,DUPLICATE_RESULT — cameraLoginId
- q-002 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,SEMANTIC_MISS,DUPLICATE_RESULT — yolo26n-pose
- q-018 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,SEMANTIC_MISS,DUPLICATE_RESULT — Why separate MQTT event metadata from user authorization
- q-019 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,SEMANTIC_MISS,DUPLICATE_RESULT — TensorRT 도입을 보류하거나 신중히 검증한 근거
- q-019 [hybrid-rrf]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,DUPLICATE_RESULT — TensorRT 도입을 보류하거나 신중히 검증한 근거
- q-023 [hybrid-contextual]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,DUPLICATE_RESULT — RTSP부터 대시보드 알림까지 end-to-end 파이프라인 구성요소
- q-023 [hybrid-contextual-diversify-max2]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,DUPLICATE_RESULT — RTSP부터 대시보드 알림까지 end-to-end 파이프라인 구성요소
- q-024 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,SEMANTIC_MISS,DUPLICATE_RESULT — pose extraction tracking and LSTM classification stages
- q-024 [hybrid-rrf]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,DUPLICATE_RESULT — pose extraction tracking and LSTM classification stages

## 9–10. DUPLICATE / WRONG_TOP1
- vector-only-structure-aware: DUP=164 WRONG_TOP1=6 (taxonomy DUPLICATE=56)
- lexical-only: DUP=167 WRONG_TOP1=9 (taxonomy DUPLICATE=55)
- hybrid-rrf: DUP=161 WRONG_TOP1=4 (taxonomy DUPLICATE=58)
- hybrid-diversify-max1: DUP=0 WRONG_TOP1=10 (taxonomy DUPLICATE=0)
- hybrid-diversify-max2: DUP=94 WRONG_TOP1=8 (taxonomy DUPLICATE=58)
- hybrid-contextual: DUP=158 WRONG_TOP1=7 (taxonomy DUPLICATE=58)
- hybrid-contextual-diversify-max2: DUP=91 WRONG_TOP1=11 (taxonomy DUPLICATE=58)

## 11. No-result score distributions (threshold NOT finalized)
```json
{
  "answerable": {
    "top1": {
      "count": 56,
      "min": 0.01639344262295082,
      "max": 0.03278688524590164,
      "mean": 0.030869291816021983,
      "p50": 0.03177805800756621,
      "p95": 0.03278688524590164
    },
    "top5Max": {
      "count": 56,
      "min": 0.01639344262295082,
      "max": 0.03278688524590164,
      "mean": 0.030869291816021983,
      "p50": 0.03177805800756621,
      "p95": 0.03278688524590164
    }
  },
  "unanswerable": {
    "top1": {
      "count": 5,
      "min": 0.01639344262295082,
      "max": 0.03149801587301587,
      "mean": 0.024559787436273493,
      "p50": 0.02878726010616578,
      "p95": 0.03149801587301587
    },
    "top5Max": {
      "count": 5,
      "min": 0.01639344262295082,
      "max": 0.03149801587301587,
      "mean": 0.024559787436273493,
      "p50": 0.02878726010616578,
      "p95": 0.03149801587301587
    }
  },
  "notes": "No-result threshold not finalized in Stage-3; distributions for calibration only."
}
```

## 12. Selected RRF
- best by Recall/MRR in sweep: **rrf-0** k=60 lex=1 vec=1
### RRF sweep
- rrf-0: Hit@5=0.6429 Recall@5=0.4107 MRR=0.6071
- rrf-1: Hit@5=0.6429 Recall@5=0.4107 MRR=0.6071
- rrf-2: Hit@5=0.6429 Recall@5=0.4107 MRR=0.6071
- rrf-3: Hit@5=0.6429 Recall@5=0.4107 MRR=0.6071

## 13. Promotion decisions
- lexical-only: promote=false reasons=n/a regressions=no quality gain: recallΔ=-0.1379 mrrΔ=-0.1040 < 0.01; hitAt1 regressed by 0.0957 > 0.02; hitAt3 regressed by 0.1150 > 0.02; hitAt5 regressed by 0.1550 > 0.02; recallAt5 regressed by 0.1379 > 0.02; mrr regressed by 0.1040 > 0.02; ndcgAt5 regressed by 0.1248 > 0.02; duplicates increased 136 -> 167
- hybrid-rrf: promote=false reasons=n/a regressions=no quality gain: recallΔ=-0.1260 mrrΔ=-0.0385 < 0.01; hitAt3 regressed by 0.0971 > 0.02; hitAt5 regressed by 0.1371 > 0.02; recallAt5 regressed by 0.1260 > 0.02; mrr regressed by 0.0385 > 0.02; ndcgAt5 regressed by 0.0825 > 0.02; duplicates increased 136 -> 161
- hybrid-diversify-max1: promote=false reasons=n/a regressions=no quality gain: recallΔ=-0.0129 mrrΔ=-0.0022 < 0.01; hitAt3 regressed by 0.0436 > 0.02; hitAt5 regressed by 0.0300 > 0.02
- hybrid-diversify-max2: promote=false reasons=n/a regressions=no quality gain: recallΔ=-0.0575 mrrΔ=-0.0102 < 0.01; hitAt3 regressed by 0.0436 > 0.02; hitAt5 regressed by 0.0657 > 0.02; recallAt5 regressed by 0.0575 > 0.02; ndcgAt5 regressed by 0.0359 > 0.02
- hybrid-contextual: promote=false reasons=quality gain recallΔ=-0.0486 mrrΔ=0.0165 regressions=hitAt3 regressed by 0.0257 > 0.02; hitAt5 regressed by 0.0479 > 0.02; recallAt5 regressed by 0.0486 > 0.02; ndcgAt5 regressed by 0.0205 > 0.02; duplicates increased 136 -> 158
- hybrid-contextual-diversify-max2: promote=true reasons=quality gain recallΔ=0.0407 mrrΔ=0.0418 regressions=none

## Notes
- Reranker not added (Stage-3 scope).
- No-result threshold deferred to calibration stage.
- If nothing promoted, Stage-2 structure-aware vector-only remains operational best.
