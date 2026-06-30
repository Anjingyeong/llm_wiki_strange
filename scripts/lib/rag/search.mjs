import { cosineSimilarity, embedText, keywordOverlapScore } from './embedding.mjs';

const MIN_SCORE = 0.08;
const MAX_CONTEXT_CHUNKS = 4;

export function searchRelevantChunks(index, question, options = {}) {
  const queryVector = embedText(question);
  const minScore = options.minScore ?? MIN_SCORE;
  const limit = options.limit ?? MAX_CONTEXT_CHUNKS;
  return index.chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      const lexicalScore = keywordOverlapScore(question, `${chunk.title} ${chunk.section} ${chunk.text}`);
      const score = vectorScore * 0.7 + lexicalScore * 0.3;
      return { chunk, lexicalScore, score };
    })
    .filter((result) => result.lexicalScore > 0 && result.score >= minScore)
    .sort((left, right) => right.score - left.score || left.chunk.title.localeCompare(right.chunk.title))
    .slice(0, limit)
    .map((result) => ({ ...result.chunk, score: Number(result.score.toFixed(4)) }));
}
