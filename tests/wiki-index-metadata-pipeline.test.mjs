import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildRagIndexLegacy, buildRagIndexStructured } from '../scripts/lib/rag-core.mjs';
import { loadWikiDocuments } from '../scripts/lib/rag/load-documents.mjs';

const expectedMetadata = {
  type: 'decision',
  status: 'verified',
  evidenceLevel: 'production',
  verifiedAt: '2026-07-18',
  canonicalFor: 'sample-runtime',
  supersedes: ['Old-Decision'],
  supersededBy: 'Future-Decision',
  relations: ['supports:Architecture', 'depends-on:Runtime'],
};

test('Given machine metadata When loading wiki sources Then the normalized document record preserves every field', async () => {
  // Given: a real markdown source using both scalar and block-list frontmatter.
  const contentDir = await mkdtemp(join(tmpdir(), 'wiki-metadata-'));
  const source = `---
title: "Sample decision"
category: ADR
updatedAt: 2026-07-18
type: decision
status: verified
evidenceLevel: production
verifiedAt: 2026-07-18
canonicalFor: sample-runtime
supersedes:
  - Old-Decision
supersededBy: Future-Decision
relations:
  - supports:Architecture
  - depends-on:Runtime
tags: [runtime, "evidence"]
---
# Sample

The runtime decision is documented here.
`;
  await writeFile(join(contentDir, 'Sample-Decision.md'), source, 'utf8');

  try {
    // When: the operational RAG loader parses the source.
    const documents = await loadWikiDocuments(contentDir);

    // Then: downstream generators receive the complete semantic contract.
    assert.equal(documents.length, 1);
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedMetadata).map((key) => [key, documents[0][key]])),
      expectedMetadata,
    );
    assert.deepEqual(documents[0].tags, ['runtime', 'evidence']);
  } finally {
    await rm(contentDir, { recursive: true, force: true });
  }
});

test('Given a normalized document When building either RAG schema Then every chunk exposes machine metadata', () => {
  // Given: the normalized document shape produced by the loader.
  const document = {
    slug: 'Sample-Decision',
    title: 'Sample decision',
    category: 'ADR',
    updatedAt: '2026-07-18',
    tags: ['runtime'],
    body: '## Decision\n\nThe runtime decision is documented here.',
    ...expectedMetadata,
  };

  // When: both operational chunk schemas are built.
  const chunks = [
    ...buildRagIndexLegacy([document]).chunks,
    ...buildRagIndexStructured([document]).chunks,
  ];

  // Then: top-level and nested metadata remain filterable without reading source markdown.
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedMetadata).map((key) => [key, chunk[key]])),
      expectedMetadata,
    );
    assert.deepEqual(
      Object.fromEntries(Object.keys(expectedMetadata).map((key) => [key, chunk.metadata[key]])),
      expectedMetadata,
    );
  }
});
