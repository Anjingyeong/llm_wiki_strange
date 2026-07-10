/**
 * Stage-3 retrieval adapters (lightweight, no external search infra).
 * LexicalRetriever / VectorRetriever / RankFusion / HybridRetriever / ResultDiversifier
 */
import { cosineSimilarity, embedText, keywordOverlapScore, tokenize } from './embedding.mjs';
import { rankBm25 } from './bm25.mjs';
import { filterCandidateChunks, inferMetadataFilters, metadataBoost, normalizeList } from './filters.mjs';
import { diversifyResults as defaultDiversify, fuseWithRrf, preview } from './fusion.mjs';

const MIN_SCORE = 0.03;

export function buildChunkSearchText(chunk) {
  return [
    chunk.title,
    chunk.displayTitle,
    chunk.navTitle,
    chunk.shortTitle,
    chunk.slug,
    chunk.documentSlug,
    chunk.summary,
    chunk.category,
    chunk.sectionTitle ?? chunk.section,
    chunk.headingPath,
    chunk.chunkType,
    chunk.contextualPrefix,
    ...normalizeList(chunk.tags),
    ...normalizeList(chunk.codeSymbols),
    ...normalizeList(chunk.referencedFiles),
    ...normalizeList(chunk.relatedDocs),
    ...normalizeList(chunk.relatedSlugs),
    chunk.updatedAt,
    chunk.sourcePath,
    chunk.sourceFile,
    chunk.text,
    chunk.content,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Exact-term oriented lexical features for BM25 field boost. */
export function buildExactTermText(chunk) {
  return [
    chunk.slug,
    chunk.documentSlug,
    chunk.title,
    chunk.displayTitle,
    chunk.navTitle,
    chunk.shortTitle,
    chunk.headingPath,
    chunk.sectionTitle,
    ...normalizeList(chunk.tags),
    ...normalizeList(chunk.codeSymbols),
    ...normalizeList(chunk.referencedFiles),
    ...normalizeList(chunk.relatedDocs),
    chunk.sourcePath,
    chunk.sourceFile,
    // preserve symbols/env-like tokens from content
    String(chunk.content || chunk.text || '').match(
      /(?:[A-Z][A-Z0-9_]{2,}|[a-zA-Z_][\w.-]*\.(?:py|ts|tsx|js|mjs|java|yml|yaml|md|json|sh|bat)|--[\w-]+|VITE_[\w]+|RAG_[\w]+|cameraLoginId|cam_\d+|yolo[\w.-]*|ByteTrack|LSTM|RTSP|WebRTC|MQTT|MediaMTX|TensorRT|pgvector)/g,
    )?.join(' ') || '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function lexicalSearchText(chunk) {
  // Blend exact fields (3x) with full search text for BM25
  return `${buildExactTermText(chunk)} ${buildExactTermText(chunk)} ${buildExactTermText(chunk)} ${buildChunkSearchText(chunk)}`;
}

export class VectorRetriever {
  constructor(options = {}) {
    this.minScore = options.minScore ?? MIN_SCORE;
  }

  retrieve(chunks, query, { filters = null, retrieveLimit = 30, pureVector = true } = {}) {
    const safeFilters = filters && Array.isArray(filters.categories)
      ? filters
      : inferMetadataFilters(query, filters || {});
    const queryVector = embedText(query);
    return chunks
      .map((chunk) => {
        const vectorScore = cosineSimilarity(queryVector, chunk.embedding || []);
        const lexicalScore = pureVector ? 0 : keywordOverlapScore(query, buildChunkSearchText(chunk));
        const score = pureVector
          ? vectorScore * metadataBoost(chunk, safeFilters)
          : (vectorScore * 0.75 + lexicalScore * 0.25) * metadataBoost(chunk, safeFilters);
        return { chunk, score, vectorScore, lexicalScore, rawScore: vectorScore };
      })
      .filter((result) => {
        if (pureVector) {
          return result.score >= this.minScore;
        }
        // Pre-stage3 hybrid vector path: require lexical evidence OR strong pure vector.
        if (result.lexicalScore > 0) {
          return result.score >= this.minScore;
        }
        return result.vectorScore >= 0.55 && result.score >= this.minScore;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, retrieveLimit);
  }
}

export class LexicalRetriever {
  retrieve(chunks, query, { filters = null, retrieveLimit = 30 } = {}) {
    const safeFilters = filters && Array.isArray(filters.categories)
      ? filters
      : inferMetadataFilters(query, filters || {});
    const ranked = rankBm25(chunks, query, safeFilters, retrieveLimit, metadataBoost, lexicalSearchText);
    return ranked.map((result) => ({
      ...result,
      lexicalScore: result.score,
      vectorScore: 0,
      rawScore: result.score,
    }));
  }
}

export class RankFusion {
  constructor(options = {}) {
    this.rrfK = options.rrfK ?? 60;
    this.lexicalWeight = options.lexicalWeight ?? 1.0;
    this.vectorWeight = options.vectorWeight ?? 1.0;
  }

  fuse(bm25Results, vectorResults) {
    // Weighted RRF: scale contribution per list
    const fused = new Map();
    const addRanked = (results, method, weight) => {
      results.forEach((result, index) => {
        const rank = index + 1;
        const existing = fused.get(result.chunk.id) ?? {
          chunk: result.chunk,
          score: 0,
          matchedBy: new Set(),
          reason: [],
          lexicalScore: 0,
          vectorScore: 0,
          rawScore: 0,
        };
        existing.score += (weight * 1) / (this.rrfK + rank);
        existing.matchedBy.add(method);
        existing.reason.push(`${method}:rank=${rank}:w=${weight}`);
        if (method === 'bm25' || method === 'lexical') {
          existing.lexicalScore = Math.max(existing.lexicalScore, result.score || result.lexicalScore || 0);
        }
        if (method === 'vector') {
          existing.vectorScore = Math.max(existing.vectorScore, result.vectorScore || result.score || 0);
        }
        existing.rawScore = existing.score;
        fused.set(result.chunk.id, existing);
      });
    };
    // Keep 'bm25' label for answer.mjs hasSufficientContext compatibility.
    addRanked(bm25Results, 'bm25', this.lexicalWeight);
    addRanked(vectorResults, 'vector', this.vectorWeight);
    return [...fused.values()]
      .map((result) => ({
        ...result,
        matchedBy: [...result.matchedBy, 'rrf'],
        reason: result.reason.join('; '),
      }))
      .sort((a, b) => b.score - a.score);
  }
}

export class ResultDiversifier {
  constructor(options = {}) {
    this.maxChunksPerDocument = options.maxChunksPerDocument ?? 2;
    this.documentDeduplication = options.documentDeduplication !== false;
    this.headingDiversity = Boolean(options.headingDiversity);
  }

  diversify(results, limit) {
    if (!this.documentDeduplication || this.maxChunksPerDocument <= 0) {
      return results.slice(0, limit);
    }
    const docCounts = new Map();
    const headingCounts = new Map();
    const selected = [];
    for (const result of results) {
      const docId = result.chunk.documentId || result.chunk.documentSlug || result.chunk.slug;
      const heading = result.chunk.headingPath || result.chunk.sectionTitle || '';
      const docCount = docCounts.get(docId) ?? 0;
      if (docCount >= this.maxChunksPerDocument) {
        continue;
      }
      if (this.headingDiversity && heading) {
        const key = `${docId}::${heading}`;
        if ((headingCounts.get(key) ?? 0) >= 1 && docCount >= 1) {
          // allow second chunk only from different heading when diversity on
        }
      }
      docCounts.set(docId, docCount + 1);
      if (heading) {
        const key = `${docId}::${heading}`;
        headingCounts.set(key, (headingCounts.get(key) ?? 0) + 1);
      }
      selected.push(result);
      if (selected.length >= limit) break;
    }
    // If we under-filled, backfill by score while still respecting per-document caps.
    if (selected.length < limit) {
      for (const result of results) {
        if (selected.some((item) => item.chunk.id === result.chunk.id)) continue;
        const docId = result.chunk.documentId || result.chunk.documentSlug || result.chunk.slug;
        const docCount = docCounts.get(docId) ?? 0;
        if (this.documentDeduplication && docCount >= this.maxChunksPerDocument) continue;
        docCounts.set(docId, docCount + 1);
        selected.push(result);
        if (selected.length >= limit) break;
      }
    }
    return selected;
  }
}

export class HybridRetriever {
  constructor(options = {}) {
    this.vector = new VectorRetriever(options.vector || {});
    this.lexical = new LexicalRetriever(options.lexical || {});
    this.fusion = new RankFusion(options.fusion || {});
    this.diversifier = options.diversify
      ? new ResultDiversifier(options.diversify)
      : null;
    this.lexicalTopN = options.lexicalTopN ?? 30;
    this.vectorTopN = options.vectorTopN ?? 30;
    this.mode = options.mode || 'hybrid';
    // false matches pre-stage3 hybrid rankVector default (vector+light lexical blend)
    this.pureVectorHybrid = options.pureVectorHybrid ?? false;
  }

  retrieve(index, question, options = {}) {
    const retrieveLimit = options.retrieveLimit ?? Math.max(this.lexicalTopN, this.vectorTopN);
    const limit = options.limit ?? 6;
    const filters = inferMetadataFilters(question, options.filters ?? {});
    const candidates = filterCandidateChunks(index.chunks || [], filters);

    const mode = options.mode || this.mode;

    if (mode === 'baseline' || mode === 'vector' || mode === 'vector-only') {
      const vectorResults = this.vector.retrieve(candidates, question, {
        filters,
        retrieveLimit,
        pureVector: true,
      });
      const finalResults = vectorResults.slice(0, limit).map((result) => ({
        ...result.chunk,
        score: Number(result.score.toFixed(4)),
        rawScore: result.rawScore ?? result.score,
        matchedBy: ['vector'],
        reason: 'vector',
        vectorScore: result.vectorScore,
        lexicalScore: 0,
      }));
      return {
        results: finalResults,
        debug: {
          query: question,
          mode,
          filters,
          inferredFilters: filters,
          bm25Results: [],
          vectorResults: vectorResults.slice(0, 8).map((r) => preview(r, ['vector'])),
          rrfResults: [],
          finalContextChunks: finalResults.map(mapFinal),
          overlap: { lexicalIds: [], vectorIds: vectorResults.map((r) => r.chunk.id), intersection: 0 },
        },
      };
    }

    if (mode === 'lexical' || mode === 'lexical-only') {
      const lexicalResults = this.lexical.retrieve(candidates, question, {
        filters,
        retrieveLimit,
      });
      const finalResults = lexicalResults.slice(0, limit).map((result) => ({
        ...result.chunk,
        score: Number(result.score.toFixed(4)),
        rawScore: result.rawScore ?? result.score,
        matchedBy: ['bm25'],
        reason: 'bm25',
        vectorScore: 0,
        lexicalScore: result.score,
      }));
      return {
        results: finalResults,
        debug: {
          query: question,
          mode,
          filters,
          inferredFilters: filters,
          bm25Results: lexicalResults.slice(0, 8).map((r) => preview(r, ['bm25'])),
          vectorResults: [],
          rrfResults: [],
          finalContextChunks: finalResults.map(mapFinal),
          overlap: { lexicalIds: lexicalResults.map((r) => r.chunk.id), vectorIds: [], intersection: 0 },
        },
      };
    }

    // hybrid (+ optional diversify)
    // Legacy hybrid blended vector with light lexical (pureVector=false). Stage-3 can force pure via options.pureVector.
    const hybridPureVector = options.pureVector ?? this.pureVectorHybrid ?? false;
    const lexicalResults = this.lexical.retrieve(candidates, question, {
      filters,
      retrieveLimit: this.lexicalTopN,
    });
    const vectorResults = this.vector.retrieve(candidates, question, {
      filters,
      retrieveLimit: this.vectorTopN,
      pureVector: hybridPureVector,
    });
    let fused = this.fusion.fuse(lexicalResults, vectorResults);
    if (this.diversifier) {
      fused = this.diversifier.diversify(fused, limit);
    } else {
      fused = fused.slice(0, limit);
    }

    const lexicalIds = new Set(lexicalResults.map((r) => r.chunk.id));
    const vectorIds = new Set(vectorResults.map((r) => r.chunk.id));
    let intersection = 0;
    for (const id of lexicalIds) {
      if (vectorIds.has(id)) intersection += 1;
    }

    const finalResults = fused.map((result) => ({
      ...result.chunk,
      score: Number(result.score.toFixed(4)),
      rawScore: result.rawScore ?? result.score,
      matchedBy: result.matchedBy,
      reason: result.reason,
      vectorScore: result.vectorScore,
      lexicalScore: result.lexicalScore,
    }));

    return {
      results: finalResults,
      debug: {
        query: question,
        mode,
        filters,
        inferredFilters: filters,
        bm25Results: lexicalResults.slice(0, 8).map((r) => preview(r, ['lexical'])),
        vectorResults: vectorResults.slice(0, 8).map((r) => preview(r, ['vector'])),
        rrfResults: fused.slice(0, 8).map((r) => preview(r, r.matchedBy)),
        finalContextChunks: finalResults.map(mapFinal),
        overlap: {
          lexicalIds: [...lexicalIds],
          vectorIds: [...vectorIds],
          intersection,
          lexicalCount: lexicalIds.size,
          vectorCount: vectorIds.size,
        },
        fusion: {
          rrfK: this.fusion.rrfK,
          lexicalWeight: this.fusion.lexicalWeight,
          vectorWeight: this.fusion.vectorWeight,
        },
        diversify: this.diversifier
          ? {
              maxChunksPerDocument: this.diversifier.maxChunksPerDocument,
              documentDeduplication: this.diversifier.documentDeduplication,
              headingDiversity: this.diversifier.headingDiversity,
            }
          : null,
      },
    };
  }
}

function mapFinal(chunk) {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    title: chunk.title,
    displayTitle: chunk.displayTitle ?? chunk.title,
    category: chunk.category,
    sectionTitle: chunk.sectionTitle ?? chunk.section,
    sourcePath: chunk.sourcePath,
    matchedBy: chunk.matchedBy,
    score: chunk.score,
    rawScore: chunk.rawScore,
  };
}

export function createRetrieverFromConfig(config = {}) {
  return new HybridRetriever({
    mode: config.mode || 'hybrid',
    lexicalTopN: config.lexicalTopN ?? 30,
    vectorTopN: config.vectorTopN ?? 30,
    pureVectorHybrid: config.pureVectorHybrid ?? false,
    fusion: {
      rrfK: config.rrfK ?? 60,
      lexicalWeight: config.lexicalWeight ?? 1.0,
      vectorWeight: config.vectorWeight ?? 1.0,
    },
    diversify: config.diversify || null,
    vector: { minScore: config.minScore ?? MIN_SCORE },
  });
}
