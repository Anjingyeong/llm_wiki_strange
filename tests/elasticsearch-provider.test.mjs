import test from 'node:test';
import assert from 'node:assert/strict';

import { indexDefinition, toElasticDocument } from '../scripts/lib/rag/elasticsearch/index.mjs';
import { reciprocalRankFuse } from '../scripts/lib/rag/elasticsearch/search.mjs';

test('Elasticsearch mapping uses 256-dimensional cosine dense_vector', () => {
  const embedding = indexDefinition().mappings.properties.embedding;
  assert.equal(embedding.type, 'dense_vector');
  assert.equal(embedding.dims, 256);
  assert.equal(embedding.similarity, 'cosine');
});

test('chunk mapper preserves searchable metadata', () => {
  const chunk = {
    id: 'doc#1',
    documentId: 'doc',
    title: 'Title',
    text: 'Body',
    codeSymbols: ['frameId'],
    embedding: Array(256).fill(0),
  };
  const mapped = toElasticDocument(chunk);
  assert.equal(mapped.id, 'doc#1');
  assert.equal(mapped.content, 'Body');
  assert.deepEqual(mapped.codeSymbols, ['frameId']);
  assert.equal(mapped.embedding.length, 256);
});

test('RRF rewards documents appearing in both channels', () => {
  const fused = reciprocalRankFuse([
    [{ id: 'shared', matchedBy: ['elastic-bm25'] }, { id: 'lexical-only' }],
    [{ id: 'shared', matchedBy: ['elastic-knn'] }, { id: 'vector-only' }],
  ]);
  assert.equal(fused[0].id, 'shared');
  assert.deepEqual(new Set(fused[0].matchedBy), new Set(['elastic-bm25', 'elastic-knn', 'elastic-rrf']));
});
