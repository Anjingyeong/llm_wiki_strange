/**
 * Shared operational RAG index metadata helpers (Node + build scripts + CF health).
 */

export const OPERATIONAL_INDEX_REL = 'data/ragVectorIndex.json';

export function summarizeIndex(index) {
  const chunks = index?.chunks ?? [];
  const slugs = new Set(
    chunks.map((c) => c.slug || c.documentSlug || c.documentId).filter(Boolean),
  );
  return {
    source: OPERATIONAL_INDEX_REL,
    version: index?.version ?? null,
    chunkSchemaVersion: index?.chunkSchemaVersion ?? null,
    chunkCount: chunks.length,
    documentCount: slugs.size,
    generatedAt: index?.generatedAt ?? null,
    embedding: index?.embedding ?? null,
    corpusHash: index?.corpusHash ?? null,
    contentHash: index?.contentHash ?? index?.corpusHash ?? null,
    slugs: [...slugs].sort(),
  };
}

/**
 * Stale when corpusHash mismatches (if provided) or empty index.
 * Age warnings are soft (reason only) when hash is present and matches.
 * @param {object} index
 * @param {{ expectedSlugs?: string[], expectedCorpusHash?: string|null, maxAgeHours?: number, now?: Date }} [opts]
 */
export function detectStaleIndex(index, opts = {}) {
  const reasons = [];
  const meta = summarizeIndex(index);
  if (!meta.chunkCount) {
    reasons.push('empty_chunks');
  }
  if (opts.expectedCorpusHash) {
    if (!meta.corpusHash) {
      reasons.push('missing_corpusHash');
    } else if (meta.corpusHash !== opts.expectedCorpusHash) {
      reasons.push('corpusHash_mismatch');
    }
  }
  if (!meta.generatedAt) {
    reasons.push('missing_generatedAt');
  }
  const expected = opts.expectedSlugs ?? [];
  const missing = expected.filter((s) => !meta.slugs.includes(s));
  if (missing.length) {
    reasons.push(`missing_slugs:${missing.slice(0, 12).join(',')}`);
  }
  return {
    stale: reasons.length > 0,
    reasons,
    meta,
  };
}

/**
 * Health payload shared by Node server and Cloudflare Function.
 * @param {object} index
 * @param {{ expectedCorpusHash?: string|null }} [opts]
 */
export function buildHealthPayload(index, opts = {}) {
  const env = (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const llmAnswerMode = env.ENABLE_LLM_ANSWER === 'true' ? 'llm' : 'rag_only';

  const stale = detectStaleIndex(index, {
    expectedCorpusHash: opts.expectedCorpusHash ?? index?.corpusHash ?? null,
    expectedSlugs: opts.expectedSlugs,
  });
  // If no external expected hash, treat missing hash as stale only when empty.
  if (!opts.expectedCorpusHash && index?.corpusHash && !stale.reasons.includes('empty_chunks')) {
    // Health without live FS: report meta; stale only if empty or missing generatedAt
    const soft = detectStaleIndex(index, {});
    return {
      ok: true,
      index: soft.meta,
      stale: soft.stale,
      staleReasons: soft.reasons,
      operationalSource: OPERATIONAL_INDEX_REL,
      llmAnswerMode,
    };
  }
  return {
    ok: true,
    index: stale.meta,
    stale: stale.stale,
    staleReasons: stale.reasons,
    operationalSource: OPERATIONAL_INDEX_REL,
    llmAnswerMode,
  };
}
