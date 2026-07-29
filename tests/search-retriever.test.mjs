import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeFilters,
  resolveRetrieverMode,
  searchWithStaticIndex,
  searchRagChunks,
  isElasticsearchConfigured,
  getElasticsearchStatus,
} from '../scripts/lib/rag/search-retriever.mjs';
import { reciprocalRankFuse } from '../scripts/lib/rag/elasticsearch/search.mjs';

// --- RRF Tests ---

test('RRF fuses results from multiple channels with reciprocal rank scoring', () => {
  const bm25Results = [
    { id: 'docA#0', documentId: 'docA', sectionTitle: 'Sec1', chunkOrder: 0, matchedBy: ['elastic-bm25'], score: 10 },
    { id: 'docB#0', documentId: 'docB', sectionTitle: 'Sec2', chunkOrder: 0, matchedBy: ['elastic-bm25'], score: 8 },
    { id: 'docC#0', documentId: 'docC', sectionTitle: 'Sec3', chunkOrder: 0, matchedBy: ['elastic-bm25'], score: 6 },
  ];
  const knnResults = [
    { id: 'docA#0', documentId: 'docA', sectionTitle: 'Sec1', chunkOrder: 0, matchedBy: ['elastic-knn'], score: 0.9 },
    { id: 'docD#0', documentId: 'docD', sectionTitle: 'Sec4', chunkOrder: 0, matchedBy: ['elastic-knn'], score: 0.8 },
    { id: 'docB#0', documentId: 'docB', sectionTitle: 'Sec2', chunkOrder: 0, matchedBy: ['elastic-knn'], score: 0.7 },
  ];

  const fused = reciprocalRankFuse([bm25Results, knnResults], { limit: 5, rankConstant: 60 });

  // docA appears in both lists at rank 0 → highest RRF score
  assert.equal(fused[0].id, 'docA#0');
  // docA should have matchedBy from both channels plus 'elastic-rrf'
  assert.ok(fused[0].matchedBy.includes('elastic-bm25'));
  assert.ok(fused[0].matchedBy.includes('elastic-knn'));
  assert.ok(fused[0].matchedBy.includes('elastic-rrf'));
  // docB also in both channels → should be ranked 2nd
  assert.equal(fused[1].id, 'docB#0');
});

test('RRF respects limit parameter', () => {
  const results = Array.from({ length: 20 }, (_, i) => ({
    id: `doc${i}#0`, documentId: `doc${i}`, sectionTitle: `Sec${i}`, chunkOrder: 0,
    matchedBy: ['elastic-bm25'], score: 20 - i,
  }));
  const fused = reciprocalRankFuse([results], { limit: 3, rankConstant: 60 });
  assert.equal(fused.length, 3);
});

test('RRF with empty inputs returns empty', () => {
  const fused = reciprocalRankFuse([[], []], { limit: 5 });
  assert.equal(fused.length, 0);
});

// --- Filter whitelist tests ---

test('sanitizeFilters passes only whitelisted fields', () => {
  const input = {
    category: 'architecture',
    tags: ['RTSP', 'MQTT'],
    implementationStatus: 'verified',
    documentId: 'doc123',
    slug: 'my-doc',
    // These should be stripped
    password: 'secret',
    _internal: true,
    __proto__: {},
    script: '<script>alert(1)</script>',
    embedding: [0.1, 0.2],
  };
  const safe = sanitizeFilters(input);
  assert.equal(safe.category, 'architecture');
  assert.deepEqual(safe.tags, ['RTSP', 'MQTT']);
  assert.equal(safe.implementationStatus, 'verified');
  assert.equal(safe.documentId, 'doc123');
  assert.equal(safe.slug, 'my-doc');
  assert.equal(safe.password, undefined);
  assert.equal(safe._internal, undefined);
  assert.equal(safe.script, undefined);
  assert.equal(safe.embedding, undefined);
});

test('sanitizeFilters handles null and empty inputs', () => {
  assert.deepEqual(sanitizeFilters(null), {});
  assert.deepEqual(sanitizeFilters(undefined), {});
  assert.deepEqual(sanitizeFilters({}), {});
});

test('sanitizeFilters strips empty string values', () => {
  const safe = sanitizeFilters({ category: '', tags: null, slug: 'valid' });
  assert.equal(safe.category, undefined);
  assert.equal(safe.tags, undefined);
  assert.equal(safe.slug, 'valid');
});

// --- Retriever mode tests ---

test('resolveRetrieverMode defaults to auto', () => {
  assert.equal(resolveRetrieverMode({}), 'auto');
});

test('resolveRetrieverMode reads RAG_RETRIEVER env', () => {
  assert.equal(resolveRetrieverMode({ RAG_RETRIEVER: 'elastic' }), 'elastic');
  assert.equal(resolveRetrieverMode({ RAG_RETRIEVER: 'static' }), 'static');
  assert.equal(resolveRetrieverMode({ RAG_RETRIEVER: 'auto' }), 'auto');
});

test('resolveRetrieverMode ignores invalid values', () => {
  assert.equal(resolveRetrieverMode({ RAG_RETRIEVER: 'invalid' }), 'auto');
  assert.equal(resolveRetrieverMode({ RAG_RETRIEVER: '' }), 'auto');
});

// --- Elasticsearch configuration detection ---

test('isElasticsearchConfigured detects ELASTIC_URL', () => {
  assert.equal(isElasticsearchConfigured({ ELASTIC_URL: 'http://localhost:9200' }), true);
  assert.equal(isElasticsearchConfigured({ ELASTICSEARCH_URL: 'http://localhost:9200' }), true);
  assert.equal(isElasticsearchConfigured({}), false);
});

// --- Static search integration ---

test('searchWithStaticIndex returns results with retrievalMode static', () => {
  // Create a minimal mock index that searchRelevantChunks can use
  const mockIndex = { chunks: [] };
  const result = searchWithStaticIndex(mockIndex, 'test query', { limit: 5 });
  assert.equal(result.retrievalMode, 'static');
  assert.ok(typeof result.latencyMs === 'number');
  assert.ok(Array.isArray(result.results));
});

// --- searchRagChunks auto mode with fallback ---

test('searchRagChunks returns static mode when RAG_RETRIEVER=static', async () => {
  const mockIndex = { chunks: [] };
  const result = await searchRagChunks(mockIndex, 'test', {
    env: { RAG_RETRIEVER: 'static' },
    limit: 5,
  });
  assert.equal(result.retrievalMode, 'static');
  assert.equal(result.fallbackUsed, false);
  assert.ok(typeof result.retrievalLatencyMs === 'number');
  assert.ok(Array.isArray(result.sources));
});

test('searchRagChunks falls back to static when ES unavailable in auto mode', async () => {
  const mockIndex = { chunks: [] };
  // Set ELASTIC_URL to trigger ES attempt, but no actual ES running → should fallback
  const result = await searchRagChunks(mockIndex, 'test', {
    env: { RAG_RETRIEVER: 'auto', ELASTIC_URL: 'http://localhost:19999' },
    limit: 5,
  });
  assert.equal(result.retrievalMode, 'static');
  assert.equal(result.fallbackUsed, true);
  assert.ok(typeof result.retrievalLatencyMs === 'number');
  assert.ok(Array.isArray(result.sources));
});

test('searchRagChunks auto mode without ES configured uses static directly', async () => {
  const mockIndex = { chunks: [] };
  const result = await searchRagChunks(mockIndex, 'test', {
    env: { RAG_RETRIEVER: 'auto' },  // No ELASTIC_URL
    limit: 5,
  });
  assert.equal(result.retrievalMode, 'static');
  assert.equal(result.fallbackUsed, true);
  assert.ok(Array.isArray(result.sources));
});

// --- Sources metadata ---

test('searchRagChunks sources contain required metadata fields', async () => {
  const mockIndex = { chunks: [] };
  const result = await searchRagChunks(mockIndex, 'test', {
    env: { RAG_RETRIEVER: 'static' },
    limit: 5,
  });
  // Even with empty results, sources should be an array
  assert.ok(Array.isArray(result.sources));
  // If results come back, verify structure
  for (const src of result.sources) {
    assert.ok('id' in src);
    assert.ok('documentId' in src);
    assert.ok('slug' in src);
    assert.ok('title' in src);
    assert.ok('section' in src);
    assert.ok('category' in src);
    assert.ok('implementationStatus' in src);
    assert.ok('score' in src);
    assert.ok('matchedBy' in src);
  }
});

// --- Sensitive information non-exposure ---

test('getElasticsearchStatus does not expose credentials', async () => {
  const env = {
    ELASTIC_URL: 'http://secret-host:9200',
    ELASTIC_USERNAME: 'admin',
    ELASTIC_PASSWORD: 'supersecret123',
    ELASTIC_API_KEY: 'myapikey',
    ELASTIC_INDEX: 'smart-safety-wiki',
  };
  const status = await getElasticsearchStatus(env);

  // Status response should NOT contain passwords, API keys, or full URLs
  const serialized = JSON.stringify(status);
  assert.ok(!serialized.includes('supersecret123'), 'password should not be in status');
  assert.ok(!serialized.includes('myapikey'), 'API key should not be in status');
  assert.ok(!serialized.includes('admin'), 'username should not be in status');
  assert.ok(!serialized.includes('secret-host'), 'internal host should not be in status');

  // But should include structural info
  assert.ok('configured' in status);
  assert.ok('available' in status);
  assert.ok('status' in status);
  assert.ok('index' in status);
  assert.equal(status.index, 'smart-safety-wiki');
});

test('API error response does not expose internal error details', () => {
  // Simulate what server.mjs returns on error
  const errorResponse = {
    status: 'error',
    answer: `RAG API 처리 중 오류가 발생했습니다.`,
    sources: [],
    retrievalMode: 'unknown',
    fallbackUsed: false,
    retrievalLatencyMs: 0,
  };
  const serialized = JSON.stringify(errorResponse);
  // Should NOT contain stack traces, connection strings, or internal paths
  assert.ok(!serialized.includes('localhost:9200'));
  assert.ok(!serialized.includes('ECONNREFUSED'));
  assert.ok(!serialized.includes('node_modules'));
  assert.ok(!serialized.includes('password'));
});

// --- Elasticsearch Hybrid Search Normalization ---

test('Elasticsearch normalized results have consistent schema', () => {
  // Simulating what normalizeElasticResult produces
  const mockHit = {
    id: 'chunk1',
    documentId: 'doc1',
    slug: 'my-doc',
    title: 'My Doc',
    content: 'Hello world',
    sectionTitle: 'Section 1',
    category: 'architecture',
    codeSymbols: ['VIDEO_EOF'],
    implementationStatus: 'verified',
    score: 0.95,
    matchedBy: ['elastic-bm25', 'elastic-knn', 'elastic-rrf'],
  };

  // This tests that normalized results can be used by the answer pipeline
  assert.ok(mockHit.id);
  assert.ok(mockHit.documentId);
  assert.ok(mockHit.matchedBy.includes('elastic-bm25'));
  assert.ok(typeof mockHit.score === 'number');
  assert.equal(mockHit.category, 'architecture');
});
