import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const search = JSON.parse(
  await readFile(new URL('../src/generated/searchIndex.json', import.meta.url), 'utf8'),
);
const rag = JSON.parse(
  await readFile(new URL('../data/ragVectorIndex.json', import.meta.url), 'utf8'),
);

function assertMachineMetadata(record) {
  assert.equal(typeof record.type, 'string');
  assert.equal(typeof record.status, 'string');
  assert.equal(typeof record.evidenceLevel, 'string');
  assert.ok(Array.isArray(record.supersedes));
  assert.ok(Array.isArray(record.relations));
  if (record.status === 'verified') {
    assert.equal(typeof record.verifiedAt, 'string');
  }
}

test('Given refreshed generated indexes When reading public records Then search and RAG expose the machine contract', () => {
  // Given/When: generated search documents and operational RAG chunks are loaded above.
  const records = [
    ...search.documents,
    ...rag.chunks,
    ...rag.chunks.map((chunk) => chunk.metadata),
  ];

  // Then: every consumer can filter the normalized state without reparsing markdown.
  assert.ok(records.length > search.documents.length);
  for (const record of records) {
    assertMachineMetadata(record);
  }
});

test('Given canonical and superseded sources When indexes refresh Then lifecycle metadata remains queryable', () => {
  // Given: two known lifecycle records represented in both generated products.
  const searchCanonical = search.documents.find((document) => document.slug === 'Model-Comparison');
  const searchSuperseded = search.documents.find((document) => document.slug === 'ADR-001-WebRTC');
  const ragCanonical = rag.chunks.find((chunk) => chunk.slug === 'Model-Comparison');
  const ragSuperseded = rag.chunks.find((chunk) => chunk.slug === 'ADR-001-WebRTC');

  // When/Then: canonical and reciprocal replacement fields survive generation.
  assert.equal(searchCanonical.canonicalFor, 'yolo26n-pose');
  assert.equal(ragCanonical.metadata.canonicalFor, 'yolo26n-pose');
  assert.equal(searchSuperseded.supersededBy, 'mjpeg-display-rollback');
  assert.equal(ragSuperseded.metadata.supersededBy, 'mjpeg-display-rollback');
});
