/**
 * Shared operational RAG index metadata helpers (Node + build scripts).
 * Cloudflare bundles the JSON at build time; runtime FS is not required there.
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
 * @param {object} index
 * @param {{ expectedSlugs?: string[], maxAgeHours?: number, now?: Date }} [opts]
 */
export function detectStaleIndex(index, opts = {}) {
  const reasons = [];
  const meta = summarizeIndex(index);
  if (!meta.chunkCount) {
    reasons.push('empty_chunks');
  }
  if (!meta.generatedAt) {
    reasons.push('missing_generatedAt');
  } else {
    const ageMs = (opts.now ?? new Date()).getTime() - Date.parse(meta.generatedAt);
    const maxAgeHours = opts.maxAgeHours ?? 24 * 30;
    if (Number.isFinite(ageMs) && ageMs > maxAgeHours * 3600 * 1000) {
      reasons.push(`older_than_${maxAgeHours}h`);
    }
  }
  const expected = opts.expectedSlugs ?? [];
  const missing = expected.filter((s) => !meta.slugs.includes(s));
  if (missing.length) {
    reasons.push(`missing_slugs:${missing.slice(0, 8).join(',')}`);
  }
  return {
    stale: reasons.length > 0,
    reasons,
    meta,
  };
}
