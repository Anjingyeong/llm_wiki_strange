# Stage-3 Hybrid Search Experiment Report

- runId: `20260710-142041213_174e3f9_hybrid-stage3`
- Stage-2 anchor: **hybrid-rrf** (structure-aware vector-only)
- Selected RRF: k=60, lex=1, vec=1
- Promotion: **false** 
- Note: No Stage-3 candidate beat Stage-2 structure-aware vector-only under policy (incl. wrongTop1/duplicates).

## 1. Stage-2 baseline
| Metric | Value |
| --- | ---: |
| Hit@5 | 0.8 |
| Recall@5 | 0.55 |
| MRR | 0.6967 |
| nDCG@5 | 0.5559 |
| DUPLICATE_RESULT | 50 |
| WRONG_TOP1 | 9 |
| KEYWORD_MISS | 1 |
| SEMANTIC_MISS | 0 |
| EXPECTED_DOC_NOT_RETRIEVED | 10 |

### Stage-2 failure samples
- **DUPLICATE_RESULT** (n=46): `q-001` — cameraLoginId
- **WRONG_TOP1** (n=11): `q-004` — MediaMTX WHEP
- **KEYWORD_MISS** (n=6): `q-009` — 카메라는 어떤 아이디로 스트림과 이벤트를 맞춰야 하나요
- **SEMANTIC_MISS** (n=11): `q-005` — keypoint_bbox54
- **EXPECTED_DOC_NOT_RETRIEVED** (n=11): `q-005` — keypoint_bbox54

## 2. Candidate overall metrics
| Candidate | Hit@1 | Hit@5 | Recall@5 | MRR | nDCG@5 | Exact Hit@5 | Sem Recall@5 | Dup | WrongTop1 | NoRes | p95 | Overlap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| vector-only-structure-aware | 0.56 | 0.78 | 0.5267 | 0.6457 | 0.5219 | 0.9091 | 0.4943 | 140 | 11 | 0 | 0.5425 | 0 |
| lexical-only | 0.64 | 0.76 | 0.5133 | 0.6917 | 0.529 | 0.8182 | 0.5287 | 146 | 6 | 0.4 | 77.1795 | 0 |
| hybrid-rrf | 0.62 | 0.8 | 0.55 | 0.6967 | 0.5559 | 0.9091 | 0.523 | 140 | 9 | 1 | 83.6283 | 0.4004 |
| hybrid-diversify-max1 | 0.62 | 0.86 | 0.6767 | 0.7167 | 0.6383 | 1 | 0.6552 | 29 | 12 | 1 | 78.3182 | 0.4004 |
| hybrid-diversify-max2 | 0.62 | 0.86 | 0.6233 | 0.7167 | 0.6093 | 1 | 0.592 | 91 | 12 | 1 | 81.216 | 0.4004 |
| hybrid-contextual | 0.64 | 0.8 | 0.5133 | 0.705 | 0.534 | 0.9091 | 0.5115 | 149 | 8 | 1 | 90.0651 | 0.4007 |
| hybrid-contextual-diversify-max2 | 0.64 | 0.88 | 0.6133 | 0.7333 | 0.6034 | 1 | 0.592 | 95 | 12 | 1 | 88.8513 | 0.4007 |

## 3. Per query-type (Hit@5 / Recall@5)
### vector-only-structure-aware
- exact-term: Hit@5=0.9091 Recall@5=0.5909 MRR=0.7955 WrongTop1=2 (n=11)
- paraphrase: Hit@5=0.4444 Recall@5=0.2963 MRR=0.3 WrongTop1=2 (n=9)
- decision: Hit@5=1 Recall@5=0.5833 MRR=0.7222 WrongTop1=3 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.381 MRR=0.6905 WrongTop1=2 (n=7)
- filter: Hit@5=0.5 Recall@5=0.5 MRR=0.5 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.625 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=0.8571 Recall@5=0.7857 MRR=0.6667 WrongTop1=2 (n=7)
### lexical-only
- exact-term: Hit@5=0.8182 Recall@5=0.5909 MRR=0.7727 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.7778 Recall@5=0.5 MRR=0.6111 WrongTop1=3 (n=9)
- decision: Hit@5=0.6667 Recall@5=0.5 MRR=0.5556 WrongTop1=1 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.3333 MRR=0.75 WrongTop1=1 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.4583 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=0.8571 Recall@5=0.7857 MRR=0.8571 WrongTop1=0 (n=7)
### hybrid-rrf
- exact-term: Hit@5=0.9091 Recall@5=0.6212 MRR=0.803 WrongTop1=2 (n=11)
- paraphrase: Hit@5=0.5556 Recall@5=0.3333 MRR=0.3611 WrongTop1=3 (n=9)
- decision: Hit@5=1 Recall@5=0.6667 MRR=0.8333 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.381 MRR=0.75 WrongTop1=1 (n=7)
- filter: Hit@5=0.5 Recall@5=0.5 MRR=0.4167 WrongTop1=1 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.625 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=0.8571 Recall@5=0.7857 MRR=0.8571 WrongTop1=0 (n=7)
### hybrid-diversify-max1
- exact-term: Hit@5=1 Recall@5=0.7576 MRR=0.8333 WrongTop1=3 (n=11)
- paraphrase: Hit@5=0.6667 Recall@5=0.4815 MRR=0.3981 WrongTop1=4 (n=9)
- decision: Hit@5=1 Recall@5=0.75 MRR=0.8333 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.5714 MRR=0.75 WrongTop1=1 (n=7)
- filter: Hit@5=0.5 Recall@5=0.5 MRR=0.4167 WrongTop1=1 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.875 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=1 Recall@5=0.881 MRR=0.9048 WrongTop1=1 (n=7)
### hybrid-diversify-max2
- exact-term: Hit@5=1 Recall@5=0.6818 MRR=0.8333 WrongTop1=3 (n=11)
- paraphrase: Hit@5=0.6667 Recall@5=0.4815 MRR=0.3981 WrongTop1=4 (n=9)
- decision: Hit@5=1 Recall@5=0.6667 MRR=0.8333 WrongTop1=2 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.4286 MRR=0.75 WrongTop1=1 (n=7)
- filter: Hit@5=0.5 Recall@5=0.5 MRR=0.4167 WrongTop1=1 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.875 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=1 Recall@5=0.8333 MRR=0.9048 WrongTop1=1 (n=7)
### hybrid-contextual
- exact-term: Hit@5=0.9091 Recall@5=0.5758 MRR=0.9091 WrongTop1=0 (n=11)
- paraphrase: Hit@5=0.6667 Recall@5=0.3333 MRR=0.3796 WrongTop1=4 (n=9)
- decision: Hit@5=1 Recall@5=0.6667 MRR=0.75 WrongTop1=3 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.3333 MRR=0.7619 WrongTop1=1 (n=7)
- filter: Hit@5=0.3333 Recall@5=0.3333 MRR=0.3333 WrongTop1=0 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.625 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=0.8571 Recall@5=0.7857 MRR=0.8571 WrongTop1=0 (n=7)
### hybrid-contextual-diversify-max2
- exact-term: Hit@5=1 Recall@5=0.6364 MRR=0.9394 WrongTop1=1 (n=11)
- paraphrase: Hit@5=0.7778 Recall@5=0.4444 MRR=0.4074 WrongTop1=5 (n=9)
- decision: Hit@5=1 Recall@5=0.6667 MRR=0.75 WrongTop1=3 (n=6)
- multi-doc: Hit@5=0.8571 Recall@5=0.4762 MRR=0.7619 WrongTop1=1 (n=7)
- filter: Hit@5=0.5 Recall@5=0.5 MRR=0.4167 WrongTop1=1 (n=6)
- unanswerable: Hit@5=0 Recall@5=0 MRR=0 WrongTop1=0 (n=5)
- conflict: Hit@5=1 Recall@5=0.875 MRR=1 WrongTop1=0 (n=4)
- mixed-lang: Hit@5=1 Recall@5=0.8333 MRR=0.9048 WrongTop1=1 (n=7)

## 4. Vector-only vs Hybrid deltas
- Hit@5 Δ: 0.02
- Recall@5 Δ: 0.0233
- MRR Δ: 0.051
- Dup Δ: 0
- WrongTop1 Δ: -2

## 5. Document diversification effect
- hybrid-rrf: Hit@5=0.8 Recall@5=0.55 Dup=140 WrongTop1=9
- hybrid-diversify-max1: Hit@5=0.86 Recall@5=0.6767 Dup=29 WrongTop1=12
- hybrid-diversify-max2: Hit@5=0.86 Recall@5=0.6233 Dup=91 WrongTop1=12

## 6. Contextual prefix + hybrid
- hybrid-contextual: Hit@5=0.8 ExactHit@5=0.9091 Recall@5=0.5133 MRR=0.705
- hybrid-contextual-diversify-max2: Hit@5=0.88 ExactHit@5=1 Recall@5=0.6133 MRR=0.7333

## 7. Most improved queries (sample)
- q-005 [lexical-only]: 0→1 — keypoint_bbox54
- q-005 [hybrid-rrf]: 0→1 — keypoint_bbox54
- q-005 [hybrid-diversify-max1]: 0→1 — keypoint_bbox54
- q-005 [hybrid-diversify-max2]: 0→1 — keypoint_bbox54
- q-005 [hybrid-contextual]: 0→1 — keypoint_bbox54
- q-005 [hybrid-contextual-diversify-max2]: 0→1 — keypoint_bbox54
- q-009 [lexical-only]: 0→1 — 카메라는 어떤 아이디로 스트림과 이벤트를 맞춰야 하나요
- q-009 [hybrid-rrf]: 0→1 — 카메라는 어떤 아이디로 스트림과 이벤트를 맞춰야 하나요
- q-009 [hybrid-diversify-max1]: 0→1 — 카메라는 어떤 아이디로 스트림과 이벤트를 맞춰야 하나요
- q-009 [hybrid-diversify-max2]: 0→1 — 카메라는 어떤 아이디로 스트림과 이벤트를 맞춰야 하나요

## 8. Worsened queries (sample)
- q-001 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,SEMANTIC_MISS,DUPLICATE_RESULT — cameraLoginId
- q-001 [hybrid-rrf]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,DUPLICATE_RESULT — cameraLoginId
- q-001 [hybrid-contextual]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,DUPLICATE_RESULT — cameraLoginId
- q-002 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,SEMANTIC_MISS,DUPLICATE_RESULT — yolo26n-pose
- q-011 [hybrid-rrf]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED — 쓰러짐 감지를 잘 하려고 pose 모델을 고른 이유는
- q-011 [hybrid-diversify-max1]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED — 쓰러짐 감지를 잘 하려고 pose 모델을 고른 이유는
- q-011 [hybrid-diversify-max2]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED — 쓰러짐 감지를 잘 하려고 pose 모델을 고른 이유는
- q-018 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,SEMANTIC_MISS,DUPLICATE_RESULT — Why separate MQTT event metadata from user authorization
- q-019 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,SEMANTIC_MISS,DUPLICATE_RESULT — TensorRT 도입을 보류하거나 신중히 검증한 근거
- q-030 [lexical-only]: 1→0 failures=EXPECTED_DOC_NOT_RETRIEVED,KEYWORD_MISS,SEMANTIC_MISS,DUPLICATE_RESULT — Bug RTSP stream 404 troubleshooting

## 9–10. DUPLICATE / WRONG_TOP1
- vector-only-structure-aware: DUP=140 WRONG_TOP1=11 (taxonomy DUPLICATE=50)
- lexical-only: DUP=146 WRONG_TOP1=6 (taxonomy DUPLICATE=49)
- hybrid-rrf: DUP=140 WRONG_TOP1=9 (taxonomy DUPLICATE=50)
- hybrid-diversify-max1: DUP=29 WRONG_TOP1=12 (taxonomy DUPLICATE=10)
- hybrid-diversify-max2: DUP=91 WRONG_TOP1=12 (taxonomy DUPLICATE=50)
- hybrid-contextual: DUP=149 WRONG_TOP1=8 (taxonomy DUPLICATE=52)
- hybrid-contextual-diversify-max2: DUP=95 WRONG_TOP1=12 (taxonomy DUPLICATE=52)

## 11. No-result score distributions (threshold NOT finalized)
```json
{
  "answerable": {
    "top1": {
      "count": 50,
      "min": 0.025124843945068663,
      "max": 0.03278688524590164,
      "mean": 0.03182115826985272,
      "p50": 0.03252247488101534,
      "p95": 0.03278688524590164
    },
    "top5Max": {
      "count": 50,
      "min": 0.025124843945068663,
      "max": 0.03278688524590164,
      "mean": 0.03182115826985272,
      "p50": 0.03252247488101534,
      "p95": 0.03278688524590164
    }
  },
  "unanswerable": {
    "top1": {
      "count": 5,
      "min": 0.01639344262295082,
      "max": 0.030158730158730156,
      "mean": 0.024087534120933327,
      "p50": 0.02854251012145749,
      "p95": 0.030158730158730156
    },
    "top5Max": {
      "count": 5,
      "min": 0.01639344262295082,
      "max": 0.030158730158730156,
      "mean": 0.024087534120933327,
      "p50": 0.02854251012145749,
      "p95": 0.030158730158730156
    }
  },
  "notes": "No-result threshold not finalized in Stage-3; distributions for calibration only."
}
```

## 12. Selected RRF
- best by Recall/MRR in sweep: **rrf-0** k=60 lex=1 vec=1
### RRF sweep
- rrf-0: Hit@5=0.8 Recall@5=0.55 MRR=0.6967
- rrf-1: Hit@5=0.8 Recall@5=0.55 MRR=0.6967
- rrf-2: Hit@5=0.8 Recall@5=0.55 MRR=0.6967
- rrf-3: Hit@5=0.8 Recall@5=0.55 MRR=0.6967

## 13. Promotion decisions
- lexical-only: promote=false reasons=n/a regressions=no quality gain: recallΔ=-0.0367 mrrΔ=-0.0050 < 0.01; hitAt3 regressed by 0.0200 > 0.02; hitAt5 regressed by 0.0400 > 0.02; recallAt5 regressed by 0.0367 > 0.02; ndcgAt5 regressed by 0.0269 > 0.02; noResultAccuracy regressed by 0.6000 > 0.02; duplicates increased 140 -> 146
- hybrid-rrf: promote=false reasons=n/a regressions=no quality gain: recallΔ=0.0000 mrrΔ=0.0000 < 0.01
- hybrid-diversify-max1: promote=false reasons=quality gain recallΔ=0.1267 mrrΔ=0.0200 regressions=wrongTop1 increased 9 -> 12
- hybrid-diversify-max2: promote=false reasons=quality gain recallΔ=0.0733 mrrΔ=0.0200 regressions=wrongTop1 increased 9 -> 12
- hybrid-contextual: promote=false reasons=n/a regressions=no quality gain: recallΔ=-0.0367 mrrΔ=0.0083 < 0.01; recallAt5 regressed by 0.0367 > 0.02; ndcgAt5 regressed by 0.0220 > 0.02; duplicates increased 140 -> 149
- hybrid-contextual-diversify-max2: promote=false reasons=quality gain recallΔ=0.0633 mrrΔ=0.0367 regressions=wrongTop1 increased 9 -> 12

## Notes
- Reranker not added (Stage-3 scope).
- No-result threshold deferred to calibration stage.
- If nothing promoted, Stage-2 structure-aware vector-only remains operational best.
