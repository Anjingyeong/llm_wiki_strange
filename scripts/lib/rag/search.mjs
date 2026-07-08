import { cosineSimilarity, embedText, keywordOverlapScore } from './embedding.mjs';
import { rankBm25 } from './bm25.mjs';
import { filterCandidateChunks, inferMetadataFilters, metadataBoost, normalizeList } from './filters.mjs';
import { applyReranker, diversifyResults, fuseWithRrf, preview } from './fusion.mjs';
import { readBooleanEnv } from './env.mjs';

const MIN_SCORE = 0.03;
const DEFAULT_RRF_K = 60;
const DEFAULT_RETRIEVE_LIMIT = 40;
const DEFAULT_CONTEXT_LIMIT = 6;

function chunkSearchText(chunk) {
  return [
    chunk.title,
    chunk.displayTitle,
    chunk.navTitle,
    chunk.shortTitle,
    chunk.slug,
    chunk.summary,
    chunk.category,
    chunk.sectionTitle ?? chunk.section,
    ...normalizeList(chunk.tags),
    chunk.updatedAt,
    chunk.sourcePath,
    chunk.text,
  ]
    .filter(Boolean)
    .join(' ');
}

function rankVector(chunks, query, filters, retrieveLimit, options = {}) {
  const queryVector = embedText(query);
  const pureVector = options.pureVector ?? false;
  return chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      const lexicalScore = pureVector ? 0 : keywordOverlapScore(query, chunkSearchText(chunk));
      const score = pureVector ? vectorScore * metadataBoost(chunk, filters) : (vectorScore * 0.75 + lexicalScore * 0.25) * metadataBoost(chunk, filters);
      return { chunk, lexicalScore, score, vectorScore };
    })
    .filter((result) => {
      if (pureVector) {
        return result.score >= MIN_SCORE;
      }
      if (result.lexicalScore > 0) {
        return result.score >= MIN_SCORE;
      }
      return result.vectorScore >= 0.55 && result.score >= MIN_SCORE;
    })
    .sort((left, right) => right.score - left.score || String(left.chunk.displayTitle ?? left.chunk.title).localeCompare(String(right.chunk.displayTitle ?? right.chunk.title)))
    .slice(0, retrieveLimit);
}

function makeDebug({ query, filters, bm25Results, vectorResults, rrfResults, finalResults }) {
  return {
    query,
    inferredFilters: filters,
    bm25Results: bm25Results.slice(0, 8).map((result) => preview(result, ['bm25'])),
    vectorResults: vectorResults.slice(0, 8).map((result) => preview(result, ['vector'])),
    rrfResults: rrfResults.slice(0, 8).map((result) => preview(result, result.matchedBy)),
    finalContextChunks: finalResults.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      title: chunk.title,
      displayTitle: chunk.displayTitle ?? chunk.title,
      category: chunk.category,
      sectionTitle: chunk.sectionTitle ?? chunk.section,
      sourcePath: chunk.sourcePath,
      matchedBy: chunk.matchedBy,
      score: chunk.score,
    })),
  };
}

function attachDebug(results, debug, options) {
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  if (options.debug || readBooleanEnv(env, 'RAG_DEBUG', false)) {
    Object.defineProperty(results, 'debug', {
      enumerable: true,
      value: debug,
    });
  }
  return results;
}

export function searchRelevantChunks(index, question, options = {}) {
  const retrieveLimit = options.retrieveLimit ?? DEFAULT_RETRIEVE_LIMIT;
  const limit = options.limit ?? DEFAULT_CONTEXT_LIMIT;
  const filters = inferMetadataFilters(question, options.filters ?? {});
  const candidates = filterCandidateChunks(index.chunks, filters);

  if (options.mode === 'baseline') {
    const vectorResults = rankVector(candidates, question, filters, retrieveLimit, { pureVector: true });
    const finalResults = vectorResults.slice(0, limit).map((result) => ({
      ...result.chunk,
      score: Number(result.score.toFixed(4)),
      matchedBy: ['vector'],
      reason: 'vector',
    }));
    return attachDebug(
      finalResults,
      makeDebug({ query: question, filters, bm25Results: [], vectorResults, rrfResults: [], finalResults }),
      options,
    );
  }

  const bm25Results = rankBm25(candidates, question, filters, retrieveLimit, metadataBoost, chunkSearchText);
  const vectorResults = rankVector(candidates, question, filters, retrieveLimit);
  const rrfResults = fuseWithRrf({
    bm25Results,
    vectorResults,
    rrfK: options.rrfK ?? DEFAULT_RRF_K,
  });
  const rerankedResults = applyReranker(rrfResults, question, options);
  const finalResults = diversifyResults(rerankedResults, limit).map((result) => ({
    ...result.chunk,
    score: Number(result.score.toFixed(4)),
    matchedBy: result.matchedBy,
    reason: result.reason,
  }));

  return attachDebug(
    finalResults,
    makeDebug({ query: question, filters, bm25Results, vectorResults, rrfResults, finalResults }),
    options,
  );
}
