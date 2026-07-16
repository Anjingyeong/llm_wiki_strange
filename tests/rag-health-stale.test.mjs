import assert from 'node:assert/strict';
import { buildHealthPayload, detectStaleIndex } from '../scripts/lib/rag/index-meta.mjs';

const fresh = {
  chunks: [{ slug: 'A' }],
  corpusHash: 'h1',
  generatedAt: new Date().toISOString(),
};

const staleHash = {
  chunks: [{ slug: 'A' }],
  corpusHash: 'h2',
  generatedAt: new Date().toISOString(),
};

const empty = { chunks: [] };

{
  const p = buildHealthPayload(fresh, { expectedCorpusHash: 'h1' });
  assert.equal(p.ok, true);
  assert.equal(p.stale, false);
}

{
  const p = buildHealthPayload(staleHash, { expectedCorpusHash: 'h1' });
  assert.equal(p.stale, true);
  assert.ok(p.staleReasons.includes('corpusHash_mismatch'));
}

{
  const p = buildHealthPayload(empty);
  assert.equal(p.stale, true);
}

{
  const d = detectStaleIndex(fresh, { expectedCorpusHash: 'h1' });
  assert.equal(d.stale, false);
}

console.log('rag-health-stale OK');
