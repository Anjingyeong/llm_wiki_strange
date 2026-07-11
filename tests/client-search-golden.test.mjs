import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { searchDocumentsInIndex } from '../src/lib/searchCore.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadIndex() {
  return JSON.parse(await readFile(join(root, 'src/generated/searchIndex.json'), 'utf8'));
}

async function loadGolden() {
  return JSON.parse(await readFile(join(root, 'data/client-search/golden-queries.json'), 'utf8'));
}

describe('client-search golden queries', () => {
  it('dataset loads with required fields', async () => {
    const golden = await loadGolden();
    assert.ok(Array.isArray(golden.queries) && golden.queries.length >= 10);
    for (const q of golden.queries) {
      assert.ok(q.id && q.query != null);
      assert.ok(Array.isArray(q.expectedSlugs));
    }
  });

  it('each required golden query hits expected slug in topK', async () => {
    const index = await loadIndex();
    const golden = await loadGolden();
    const failures = [];

    for (const q of golden.queries) {
      const topK = q.topK ?? golden.defaultTopK ?? 3;
      const results = searchDocumentsInIndex(index, q.query, { limit: Math.max(topK, 10) });
      const top = results.slice(0, topK);
      const topSlugs = top.map((r) => r.slug);

      if (q.expectEmptyOrWeak) {
        // No-result or very weak: either empty or top1 score far below a real title hit
        const topScore = top[0]?.score ?? 0;
        if (topScore >= 40) {
          failures.push(`${q.id}: expected weak/empty for "${q.query}" but top score=${topScore} slug=${topSlugs[0]}`);
        }
        continue;
      }

      if (q.optional) {
        continue;
      }

      if (!q.expectedSlugs.length) continue;

      const hit = q.expectedSlugs.some((slug) => topSlugs.includes(slug));
      if (!hit) {
        failures.push(
          `${q.id}: query="${q.query}" expected one of [${q.expectedSlugs.join(', ')}] in top${topK}, got [${topSlugs.join(', ')}]`,
        );
      }

      // Unrelated noise: Glossary alone as top1 when query is clearly ED technical — soft guard
      if (top[0] && q.expectedSlugs.length && !q.expectedSlugs.includes(top[0].slug)) {
        // allow if any expected is in topK (already checked); only fail if top1 is totally off-domain and expected missed
      }
    }

    assert.equal(failures.length, 0, failures.join('\n'));
  });

  it('code symbol exact queries beat unrelated high-frequency docs', async () => {
    const index = await loadIndex();
    const r = searchDocumentsInIndex(index, 'frameId', { limit: 5 });
    assert.ok(r.length > 0);
    assert.ok(
      r.slice(0, 3).some((x) => /Frame|Overlay|ED-Frame/i.test(x.slug)),
      `unexpected top: ${r.slice(0, 3).map((x) => x.slug).join(',')}`,
    );
  });
});
