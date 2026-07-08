import { readEnv } from './env.mjs';

export function preview(result, matchedBy) {
  return {
    id: result.chunk.id,
    documentId: result.chunk.documentId,
    title: result.chunk.title,
    sectionTitle: result.chunk.sectionTitle ?? result.chunk.section,
    category: result.chunk.category,
    score: Number(result.score.toFixed(4)),
    matchedBy,
  };
}

export function fuseWithRrf({ bm25Results, vectorResults, rrfK }) {
  const fused = new Map();
  const addRanked = (results, method) => {
    results.forEach((result, index) => {
      const rank = index + 1;
      const existing = fused.get(result.chunk.id) ?? {
        chunk: result.chunk,
        score: 0,
        matchedBy: new Set(),
        reason: [],
      };
      existing.score += 1 / (rrfK + rank);
      existing.matchedBy.add(method);
      existing.reason.push(`${method}:rank=${rank}`);
      fused.set(result.chunk.id, existing);
    });
  };

  addRanked(bm25Results, 'bm25');
  addRanked(vectorResults, 'vector');

  return [...fused.values()]
    .map((result) => ({
      ...result,
      matchedBy: [...result.matchedBy, 'rrf'],
      reason: result.reason.join('; '),
    }))
    .sort((left, right) => right.score - left.score || left.chunk.title.localeCompare(right.chunk.title));
}

export function applyReranker(results, query, options) {
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const mode = options.rerank ?? readEnv(env, 'RAG_RERANK_MODE', 'off');
  if (mode === 'off' || mode === false) {
    return results;
  }
  if (typeof options.reranker === 'function') {
    return options.reranker(results, { query });
  }
  return [...results].sort((left, right) => {
    const leftTitleHit = left.chunk.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    const rightTitleHit = right.chunk.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    return rightTitleHit - leftTitleHit || right.score - left.score;
  });
}

export function diversifyResults(results, limit) {
  const counts = new Map();
  const selected = [];
  for (const result of results) {
    const currentCount = counts.get(result.chunk.documentId) ?? 0;
    if (currentCount >= 2) {
      continue;
    }
    counts.set(result.chunk.documentId, currentCount + 1);
    selected.push(result);
    if (selected.length >= limit) {
      break;
    }
  }
  return selected;
}
