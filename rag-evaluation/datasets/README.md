# Golden Query Dataset

## Files

| File | Purpose |
| --- | --- |
| `golden_queries.v1.jsonl` | Versioned retrieval evaluation set (one JSON object per line) |

## Query types (balanced)

1. Exact filename / technical term
2. Paraphrased natural language
3. Technology decision rationale
4. Multi-document synthesis
5. Date / category / tag filter
6. Unanswerable (wiki has no support)
7. Conflicting newer vs older docs
8. Korean–English mixed

## Schema

```json
{
  "id": "q-001",
  "query": "...",
  "expectedDocumentSlugs": ["Slug-A"],
  "expectedSections": ["목적"],
  "expectedKeywords": ["cameraLoginId"],
  "answerable": true,
  "category": "exact-term",
  "filters": {},
  "difficulty": "easy"
}
```

- `answerable: false` → expected empty/no relevant retrieval (no-result accuracy).
- Do not put secrets, personal data, or absolute local paths in queries.
- Slugs must match `content/*.md` basenames (RAG `documentId`).

## Usage

```bash
npm run rag:eval
npm run rag:report
npm run rag:leaderboard
```

Baseline retrieval mode is pure vector search (`mode: baseline` in `scripts/lib/rag/search.mjs`) and does not modify the operational hybrid path.
