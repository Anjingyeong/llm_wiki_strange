import { expandQuery } from './answer.mjs';
import { searchRelevantChunks } from './search.mjs';

/**
 * Map internal matchedBy tags to user-facing search channels.
 * @param {string[]|undefined} matchedBy
 * @returns {string[]}
 */
export function channelLabelsFromMatchedBy(matchedBy = []) {
  const set = new Set();
  for (const raw of matchedBy) {
    const tag = String(raw || '').toLowerCase();
    if (tag === 'bm25' || tag === 'lexical' || tag === 'keyword') set.add('keyword');
    if (tag === 'vector') set.add('vector');
  }
  return [...set];
}

function shortSnippet(text, max = 220) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

function docKey(chunk) {
  return (
    chunk.slug ||
    chunk.documentSlug ||
    chunk.documentId ||
    chunk.id ||
    chunk.sourcePath ||
    chunk.title ||
    ''
  );
}

/**
 * Dedupe RRF chunk hits to one row per document, keeping the best-ranked
 * chunk snippet and merging matchedBy channels.
 * @param {object[]} chunks
 * @param {{ limit?: number }} [options]
 */
export function dedupeChunksByDocument(chunks, options = {}) {
  const limit = options.limit ?? 12;
  const best = new Map();

  for (const chunk of chunks || []) {
    const key = docKey(chunk);
    if (!key) continue;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, {
        ...chunk,
        matchedBy: [...new Set(chunk.matchedBy || [])],
      });
      continue;
    }
    const mergedMatched = new Set([
      ...(existing.matchedBy || []),
      ...(chunk.matchedBy || []),
    ]);
    // Keep higher RRF/score row; merge channels either way.
    if ((chunk.score ?? 0) > (existing.score ?? 0)) {
      best.set(key, {
        ...chunk,
        matchedBy: [...mergedMatched],
      });
    } else {
      existing.matchedBy = [...mergedMatched];
      best.set(key, existing);
    }
  }

  return [...best.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

/**
 * Build UI-facing hybrid search payload from the live RAG index.
 * Uses production hybrid mode: BM25 + Vector + RRF.
 */
export function searchHybridForUi(index, query, options = {}) {
  const q = String(query || '').trim();
  const limit = Math.min(Math.max(Number(options.limit) || 12, 1), 40);
  if (!q) {
    return {
      status: 'ok',
      mode: 'hybrid',
      query: q,
      expandedQuery: q,
      count: 0,
      results: [],
    };
  }

  // Over-fetch chunks so document dedupe still fills Top-K.
  const retrieveLimit = options.retrieveLimit ?? Math.max(40, limit * 4);
  const chunkLimit = options.chunkLimit ?? Math.max(24, limit * 3);
  const expandedQuery = options.expand === false ? q : expandQuery(q);
  const chunks = searchRelevantChunks(index, expandedQuery, {
    mode: options.mode || 'hybrid',
    limit: chunkLimit,
    retrieveLimit,
    debug: options.debug === true,
    env: options.env,
  });

  const deduped = dedupeChunksByDocument(chunks, { limit });
  const results = deduped.map((chunk, indexRank) => {
    const matchedBy = [...new Set(chunk.matchedBy || [])];
    const channels = channelLabelsFromMatchedBy(matchedBy);
    const content = chunk.content || chunk.text || chunk.summary || '';
    const sourcePath =
      chunk.sourcePath ||
      chunk.sourceFile ||
      (chunk.slug ? `content/${chunk.slug}.md` : '');
    const section = chunk.sectionTitle || chunk.section || chunk.headingPath || '';
    return {
      rank: indexRank + 1,
      slug: chunk.slug || chunk.documentSlug || chunk.documentId || '',
      documentId: chunk.documentId || chunk.slug || '',
      title: chunk.title || chunk.displayTitle || chunk.slug || '',
      displayTitle: chunk.displayTitle || chunk.title || chunk.slug || '',
      navTitle: chunk.navTitle,
      shortTitle: chunk.shortTitle,
      category: chunk.category || '',
      type: chunk.type || chunk.category || '',
      sourcePath,
      section,
      snippet: shortSnippet(content),
      score: chunk.score,
      matchedBy,
      channels,
      channelLabels: channels.map((c) => (c === 'keyword' ? 'keyword' : 'vector')),
      implementation_status: chunk.implementation_status,
      updatedAt: chunk.updatedAt,
      relatedFiles: Array.isArray(chunk.referencedFiles)
        ? chunk.referencedFiles.slice(0, 4)
        : [],
      entities: Array.isArray(chunk.entities) ? chunk.entities.slice(0, 4) : [],
      codeSymbols: Array.isArray(chunk.codeSymbols) ? chunk.codeSymbols.slice(0, 4) : [],
    };
  });

  const payload = {
    status: 'ok',
    mode: options.mode || 'hybrid',
    query: q,
    expandedQuery,
    count: results.length,
    results,
  };

  if (options.debug && chunks.debug) {
    payload.debug = chunks.debug;
  }
  return payload;
}
