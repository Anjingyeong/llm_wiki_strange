import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { searchRelevantChunks } from '../scripts/lib/rag-core.mjs';
import {
  HybridRetriever,
  LexicalRetriever,
  RankFusion,
  ResultDiversifier,
  VectorRetriever,
  createRetrieverFromConfig,
} from '../scripts/lib/rag/retrievers.mjs';
import { evaluatePromotion } from '../scripts/lib/rag-eval/promotion.mjs';

const index = JSON.parse(await readFile(new URL('../data/rag/indexes/structure-aware-v1.json', import.meta.url), 'utf8'));

test('Stage-2 regression: structure-aware vector-only still retrieves cameraLoginId docs', () => {
  const results = searchRelevantChunks(index, 'cameraLoginId', { mode: 'baseline', limit: 5, stage3: true });
  const docs = [...new Set(results.map((r) => r.documentId))];
  assert.ok(docs.length > 0);
  assert.ok(
    docs.some((id) => ['Architecture', 'Overview', 'Glossary'].includes(id)),
    `unexpected docs: ${docs.join(',')}`,
  );
});

test('adapters: lexical, vector, fusion, diversify interfaces work', () => {
  const chunks = index.chunks.slice(0, 80);
  const lex = new LexicalRetriever().retrieve(chunks, 'WebRTC WHEP', { retrieveLimit: 10, filters: null });
  const vec = new VectorRetriever().retrieve(chunks, 'WebRTC WHEP', { retrieveLimit: 10, pureVector: true, filters: null });
  assert.ok(lex.length > 0);
  assert.ok(vec.length > 0);
  const fused = new RankFusion({ rrfK: 60, lexicalWeight: 1, vectorWeight: 1 }).fuse(lex, vec);
  assert.ok(fused.length > 0);
  const div = new ResultDiversifier({ maxChunksPerDocument: 1 }).diversify(fused, 5);
  const docIds = div.map((r) => r.chunk.documentId);
  assert.ok(div.length > 0);
  assert.equal(new Set(docIds).size, docIds.length, 'max 1 chunk per document');
});

test('hybrid-raw mode returns results without requiring external services', () => {
  const retriever = createRetrieverFromConfig({
    mode: 'hybrid',
    rrfK: 60,
    lexicalWeight: 1,
    vectorWeight: 1,
    lexicalTopN: 30,
    vectorTopN: 30,
  });
  const { results, debug } = retriever.retrieve(index, 'yolo26n-pose Faint Recall', { mode: 'hybrid', limit: 5 });
  assert.ok(results.length > 0);
  assert.ok(debug.fusion);
  assert.equal(debug.fusion.rrfK, 60);
});

test('promotion blocks wrongTop1 increase even with recall gain', () => {
  const best = {
    hitAt5: 0.78,
    recallAt5: 0.52,
    mrr: 0.64,
    ndcgAt5: 0.52,
    noResultAccuracy: 0,
    p95LatencyMs: 1.5,
    duplicateIncidentOrDocumentCount: 140,
    wrongTop1Count: 11,
  };
  const cand = {
    hitAt5: 0.86,
    recallAt5: 0.67,
    mrr: 0.71,
    ndcgAt5: 0.63,
    noResultAccuracy: 0,
    p95LatencyMs: 2,
    duplicateIncidentOrDocumentCount: 29,
    wrongTop1Count: 12,
  };
  const decision = evaluatePromotion(cand, best, {
    minRecallOrMrrDelta: 0.01,
    maxQualityRegression: 0.02,
    maxNoResultAccuracyRegression: 0.02,
    maxP95LatencyIncreaseRatio: 0.3,
    minP95LatencyFloorMs: 20,
    forbidDuplicateIncrease: true,
    forbidWrongTop1Increase: true,
  });
  assert.equal(decision.promote, false);
  assert.ok(decision.regressions.some((r) => r.includes('wrongTop1')));
});
