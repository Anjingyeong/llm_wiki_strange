import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeSourcesByDocument } from '../scripts/lib/rag/source-dedupe.mjs';

test('dedupeSourcesByDocument keeps one source per slug', () => {
  const sources = [
    { slug: 'AI-Pipeline', documentId: 'a1', section: 'A' },
    { slug: 'AI-Pipeline', documentId: 'a2', section: 'B' },
    { slug: 'Develop-Code-Baseline-2026-07-15', documentId: 'd1' },
  ];
  const out = dedupeSourcesByDocument(sources);
  assert.equal(out.length, 2);
  assert.equal(out[0].slug, 'AI-Pipeline');
  assert.equal(out[1].slug, 'Develop-Code-Baseline-2026-07-15');
});