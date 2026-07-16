import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildRagIndexLegacy,
  buildRagIndexStructured,
  mergeIncrementalIndex,
} from '../scripts/lib/rag-core.mjs';
import { parseMarkdownUnits } from '../scripts/lib/rag/chunks-structured.mjs';

const sampleDoc = {
  slug: 'Sample-Doc',
  title: 'Sample Document Title',
  displayTitle: '샘플 문서',
  category: 'Architecture',
  tags: ['RTSP', 'ByteTrack'],
  updatedAt: '2026-07-10',
  summary: 'summary',
  order: 1,
  sourcePath: 'content/Sample-Doc.md',
  relatedDocs: ['Architecture'],
  body: `# Overview

Intro paragraph about cameraLoginId and RTSP.

## Decision

We chose WebRTC for latency.

| Metric | Value |
| --- | ---: |
| Hit@5 | 0.6 |

### Nested

Short.

\`\`\`python
def serve_ai_overlay():
    return "ok"
\`\`\`

## Bug

Overlay mismatch with capturedAtMs.
`,
};

test('legacy chunk schema version is preserved', () => {
  const index = buildRagIndexLegacy([sampleDoc]);
  assert.equal(index.chunkSchemaVersion, 'legacy-v1');
  assert.ok(index.chunks.length > 0);
  assert.ok(index.chunks.every((chunk) => chunk.chunkSchemaVersion === 'legacy-v1'));
});

test('structure-aware keeps heading path and does not split table rows', () => {
  const units = parseMarkdownUnits(sampleDoc.body);
  const table = units.find((unit) => unit.kind === 'table');
  assert.ok(table, 'expected table unit');
  assert.ok(table.text.includes('| Hit@5 | 0.6 |'));
  assert.ok(!table.text.split('\n').some((line) => line.includes('| Hit@5') && !line.includes('0.6')));

  const index = buildRagIndexStructured([sampleDoc], { contextualPrefix: false });
  assert.equal(index.chunkSchemaVersion, 'structure-aware-v1');
  const tableChunk = index.chunks.find((chunk) => chunk.chunkType === 'table');
  assert.ok(tableChunk);
  assert.ok(tableChunk.headingPath.includes('Decision') || tableChunk.content.includes('Hit@5'));
  assert.ok(index.chunks.some((chunk) => chunk.chunkType === 'code'));
  assert.ok(index.chunks.every((chunk) => chunk.headingPath && chunk.contentHash && chunk.chunkHash));
});

test('structure-aware chunks persist occurrence-aware section ids', () => {
  const doc = {
    ...sampleDoc,
    body: 'Preamble\n\n## 결과\n\nFirst.\n\n#### 세부\n\nNested.\n\n## 결과\n\nSecond.',
  };
  const units = parseMarkdownUnits(doc.body);
  assert.equal(units[0]?.sectionId, null);
  assert.ok(units.some((unit) => unit.sectionId === '결과' && unit.text.includes('First')));
  assert.ok(units.some((unit) => unit.sectionId === '결과' && unit.text.includes('Nested')));
  assert.ok(units.some((unit) => unit.sectionId === '결과-2' && unit.text.includes('Second')));

  const index = buildRagIndexStructured([doc], { contextualPrefix: false });
  assert.ok(index.chunks.some((chunk) => chunk.sectionId === '결과'));
  assert.ok(index.chunks.some((chunk) => chunk.sectionId === '결과-2'));
});

test('contextual prefix is prepended to searchable text', () => {
  const index = buildRagIndexStructured([sampleDoc], { contextualPrefix: true });
  assert.equal(index.chunkSchemaVersion, 'structure-aware-contextual-v1');
  const chunk = index.chunks[0];
  assert.ok(chunk.contextualPrefix.includes('문서:'));
  assert.ok(chunk.text.startsWith(chunk.contextualPrefix));
});

test('incremental reindex reuses unchanged chunk embeddings', () => {
  const first = buildRagIndexStructured([sampleDoc], { contextualPrefix: true });
  const second = buildRagIndexStructured([sampleDoc], { contextualPrefix: true });
  const merged = mergeIncrementalIndex(first, second);
  assert.ok(merged.reused > 0);
  assert.equal(merged.rebuilt, 0);
  assert.ok(merged.index.chunks.every((chunk) => chunk.reused === true));
});

test('changed content rebuilds affected chunks only', () => {
  const first = buildRagIndexStructured([sampleDoc], { contextualPrefix: false });
  const changed = {
    ...sampleDoc,
    body: `${sampleDoc.body}\n\n## Extra\n\nNew unique content about TensorRT equivalence.\n`,
  };
  const second = buildRagIndexStructured([changed], { contextualPrefix: false });
  const merged = mergeIncrementalIndex(first, second);
  assert.ok(merged.reused >= 1);
  assert.ok(merged.rebuilt >= 1);
});
