import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  NO_RESULT_THRESHOLD,
  searchDocumentsInIndex,
} from '../src/lib/searchCore.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadDocs() {
  const bundle = JSON.parse(await readFile(join(root, 'src/generated/searchIndex.json'), 'utf8'));
  return Array.isArray(bundle) ? bundle : (bundle.documents ?? []);
}

async function loadGolden() {
  return JSON.parse(await readFile(join(root, 'data/client-search/golden-queries.json'), 'utf8'));
}

describe('client-search golden queries', () => {
  it('dataset loads with required fields', async () => {
    const golden = await loadGolden();
    assert.ok(Array.isArray(golden.queries) && golden.queries.length >= 15);
    assert.equal(golden.noResultThreshold, NO_RESULT_THRESHOLD);
  });

  it('each required golden query hits expected slug in topK', async () => {
    const index = await loadDocs();
    const golden = await loadGolden();
    const failures = [];

    for (const q of golden.queries) {
      const topK = q.topK ?? golden.defaultTopK ?? 3;
      const results = searchDocumentsInIndex(index, q.query, {
        limit: Math.max(topK, 10),
        minScore: NO_RESULT_THRESHOLD,
      });
      const top = results.slice(0, topK);
      const topSlugs = top.map((r) => r.slug);

      if (q.expectEmpty || q.expectEmptyOrWeak) {
        if (results.length !== 0) {
          failures.push(
            `${q.id}: expected empty for "${q.query}" but got [${topSlugs.join(', ')}] scores=${top.map((r) => r.score).join(',')}`,
          );
        }
        continue;
      }

      if (!q.expectedSlugs.length) continue;

      const hit = q.expectedSlugs.some((slug) => topSlugs.includes(slug));
      if (!hit) {
        failures.push(
          `${q.id}: query="${q.query}" expected one of [${q.expectedSlugs.join(', ')}] in top${topK}, got [${topSlugs.join(', ')}]`,
        );
      }

      // Unrelated Top1 guard: when expected hits exist, Top1 must be in expected set
      // OR at least one expected is in topK (already required) AND Top1 is not a pure noise slug.
      if (top[0] && hit && !q.expectedSlugs.includes(top[0].slug)) {
        // Allowed only if top1 is still in expected list of ANY positive query domain — fail if top1 is empty-like
        // Real assertion: if top1 is Interview-Resume-Notes for a technical query, fail
        if (top[0].slug === 'Interview-Resume-Notes' || top[0].slug === 'Glossary') {
          // Glossary ok for cameraLoginId; Interview never for tech symbols
          if (/frame|Tensor|MQTT|낙상|overlay|worker|RTSP/i.test(q.query) && top[0].slug === 'Interview-Resume-Notes') {
            failures.push(`${q.id}: unrelated Top1 ${top[0].slug} for tech query`);
          }
        }
      }
    }

    assert.equal(failures.length, 0, failures.join('\n'));
  });

  it('텐서알티 required hit TensorRT evidence', async () => {
    const index = await loadDocs();
    const r = searchDocumentsInIndex(index, '텐서알티', { limit: 5, minScore: NO_RESULT_THRESHOLD });
    assert.ok(r.some((x) => x.slug === 'Evidence-TensorRT-Adoption-Decision'), `got ${r.map((x) => x.slug)}`);
  });

  it('code symbol exact queries beat unrelated high-frequency docs', async () => {
    const index = await loadDocs();
    const r = searchDocumentsInIndex(index, 'frameId', { limit: 5, minScore: NO_RESULT_THRESHOLD });
    assert.ok(r.length > 0);
    assert.ok(
      r.slice(0, 3).some((x) => /Frame|Overlay|ED-Frame/i.test(x.slug)),
      `unexpected top: ${r.slice(0, 3).map((x) => x.slug).join(',')}`,
    );
  });

  it('unrelated Top1 guard: technical query must not rank Interview first', async () => {
    const index = await loadDocs();
    for (const q of ['frameId', 'MQTT 이벤트', '낙상 상태 머신', 'TensorRT']) {
      const r = searchDocumentsInIndex(index, q, { limit: 1, minScore: NO_RESULT_THRESHOLD });
      if (r[0]) {
        assert.notEqual(r[0].slug, 'Interview-Resume-Notes', `query=${q}`);
      }
    }
  });
});
