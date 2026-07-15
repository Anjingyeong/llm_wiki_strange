/**
 * Deduplicate RAG answer sources by wiki document (slug preferred).
 */
export function dedupeSourcesByDocument(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return sources;
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    const key = String(source.slug || source.documentId || source.id || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}