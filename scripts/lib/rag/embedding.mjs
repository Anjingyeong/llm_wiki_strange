export const VECTOR_SIZE = 256;

const stopWords = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'what',
  'how',
  'are',
  'is',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '에',
  '의',
  '와',
  '과',
  '로',
  '으로',
  '어떻게',
  '무엇',
  '인가요',
  '되나요',
]);

export function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[`*_~()[\]{}|>#:.,!?;"'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9가-힣]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export function embedText(value) {
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  for (const token of tokenize(value)) {
    vector[stableHash(token) % VECTOR_SIZE] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  return magnitude === 0 ? vector : vector.map((item) => Number((item / magnitude).toFixed(6)));
}

export function cosineSimilarity(left, right) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return score;
}

export function keywordOverlapScore(question, text) {
  const queryTokens = new Set(tokenize(question));
  if (queryTokens.size === 0) {
    return 0;
  }
  const textTokens = new Set(tokenize(text));
  let matches = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      matches += 1;
    }
  }
  return matches / queryTokens.size;
}
