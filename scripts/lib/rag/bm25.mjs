import { tokenize } from './embedding.mjs';

const BM25_K1 = 1.4;
const BM25_B = 0.75;

export function rankBm25(chunks, query, filters, retrieveLimit, metadataBoost, chunkSearchText) {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || chunks.length === 0) {
    return [];
  }

  const docs = chunks.map((chunk) => {
    const terms = tokenize(chunkSearchText(chunk));
    const frequencies = new Map();
    for (const term of terms) {
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    }
    return { chunk, frequencies, length: terms.length };
  });
  const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length || 1;
  const documentFrequency = new Map();
  for (const term of new Set(queryTerms)) {
    documentFrequency.set(
      term,
      docs.reduce((count, doc) => count + (doc.frequencies.has(term) ? 1 : 0), 0),
    );
  }

  return docs
    .map((doc) => {
      let score = 0;
      for (const term of queryTerms) {
        const tf = doc.frequencies.get(term) ?? 0;
        if (tf === 0) {
          continue;
        }
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / averageLength));
        score += idf * ((tf * (BM25_K1 + 1)) / denominator);
      }
      return { chunk: doc.chunk, score: score * metadataBoost(doc.chunk, filters) };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || String(left.chunk.displayTitle ?? left.chunk.title).localeCompare(String(right.chunk.displayTitle ?? right.chunk.title)))
    .slice(0, retrieveLimit);
}
