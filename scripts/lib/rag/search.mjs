import { cosineSimilarity, embedText, keywordOverlapScore } from './embedding.mjs';

const MIN_SCORE = 0.08;
const MAX_CONTEXT_CHUNKS = 4;

function calculateBoost(chunk, question) {
  let boost = 1.0;
  const q = question.toLowerCase();

  // portfolio_use가 true인 경우 (문자열 "true" 또는 boolean true 처리)
  if (chunk.portfolio_use === 'true' || chunk.portfolio_use === true) {
    boost += 0.15;
  }

  // type에 따른 부스팅
  if (chunk.type === 'architecture' || chunk.type === 'overview' || chunk.type === 'evidence') {
    if (q.includes('동작') || q.includes('흐름') || q.includes('구조') || q.includes('아키텍처') || q.includes('pipeline') || q.includes('파이프라인')) {
      boost += 0.25;
    } else {
      boost += 0.1;
    }
  }

  // type: model-decision 문서는 모델 선택 질문에는 우선하지만,
  // 전체 동작 흐름 질문에서는 architecture 문서보다 우선되지 않도록 조정
  if (chunk.type === 'model-decision') {
    const isModelQuery = q.includes('모델') || q.includes('yolo') || q.includes('선택') || q.includes('결정') || q.includes('extractor') || q.includes('yolo26n');
    const isFlowQuery = q.includes('동작') || q.includes('흐름') || q.includes('구조') || q.includes('아키텍처');
    
    if (isModelQuery && !isFlowQuery) {
      boost += 0.2;
    } else if (isFlowQuery) {
      boost -= 0.1;
    }
  }

  // 프로젝트/문서군별 부스팅
  const docProject = String(chunk.project ?? '').toLowerCase();
  const docCategory = String(chunk.category ?? '').toLowerCase();
  const docType = String(chunk.type ?? '').toLowerCase();
  
  if (docProject.includes('smart-safety') || docProject.includes('safety') || docCategory.includes('ai pipeline') || docCategory.includes('experiments')) {
    boost += 0.05;
  }
  
  if (docProject.includes('portfolio') || docType.includes('evidence') || docCategory.includes('portfolio')) {
    boost += 0.05;
  }

  return boost;
}

export function searchRelevantChunks(index, question, options = {}) {
  const queryVector = embedText(question);
  const minScore = options.minScore ?? MIN_SCORE;
  const limit = options.limit ?? MAX_CONTEXT_CHUNKS;
  return index.chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      const lexicalScore = keywordOverlapScore(question, `${chunk.title} ${chunk.section} ${chunk.text}`);
      const baseScore = vectorScore * 0.7 + lexicalScore * 0.3;
      const boost = calculateBoost(chunk, question);
      const score = baseScore * boost;
      return { chunk, lexicalScore, score };
    })
    .filter((result) => result.lexicalScore > 0 && result.score >= minScore)
    .sort((left, right) => right.score - left.score || left.chunk.title.localeCompare(right.chunk.title))
    .slice(0, limit)
    .map((result) => ({ ...result.chunk, score: Number(result.score.toFixed(4)) }));
}
