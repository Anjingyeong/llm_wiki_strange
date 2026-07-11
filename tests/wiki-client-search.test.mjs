import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  expandTokenVariants,
  normalizeSearchText,
  searchDocumentsInIndex,
  tokenizeQuery,
} from '../src/lib/searchCore.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadSearchIndex() {
  const path = join(root, 'src/generated/searchIndex.json');
  const raw = await readFile(path, 'utf8');
  const bundle = JSON.parse(raw);
  return Array.isArray(bundle) ? bundle : (bundle.documents ?? []);
}

describe('search tokenization / variants', () => {
  it('normalizes NFKC and case', () => {
    assert.equal(normalizeSearchText('  FrameID  '), 'frameid');
  });

  it('expands frameId variants', () => {
    const v = expandTokenVariants('frameId').map((x) => normalizeSearchText(x));
    assert.ok(v.some((x) => x.includes('frame')));
    assert.ok(v.includes('frameid') || v.includes('frame id') || v.includes('frame_id'));
  });

  it('expands TensorRT variants', () => {
    const v = expandTokenVariants('TensorRT').map((x) => normalizeSearchText(x));
    assert.ok(v.some((x) => x.includes('tensor')));
  });
});

describe('client document search against real searchIndex', () => {
  it('ranks ED latest-frame for latest frame / 지연 queries', async () => {
    const index = await loadSearchIndex();
    const results = searchDocumentsInIndex(index, 'latest frame 지연', { limit: 20 });
    assert.ok(results.length > 0, 'expected hits');
    const slugs = results.map((r) => r.slug);
    assert.ok(
      slugs.includes('ED-Latest-Frame-Queue-Policy'),
      `expected ED-Latest-Frame-Queue-Policy in ${slugs.slice(0, 8)}`,
    );
    assert.ok(results[0].score >= results[results.length - 1].score);
    assert.ok(Array.isArray(results[0].matchReasons));
  });

  it('matches frameId identifier variants to overlay/evidence docs', async () => {
    const index = await loadSearchIndex();
    const a = searchDocumentsInIndex(index, 'frameId', { limit: 15 });
    const b = searchDocumentsInIndex(index, 'frame_id', { limit: 15 });
    assert.ok(a.length > 0 && b.length > 0);
    const aSlugs = new Set(a.map((r) => r.slug));
    assert.ok(
      a.some((r) => r.slug.includes('Frame') || r.slug.includes('Overlay') || r.slug.startsWith('ED-')),
      'frameId should hit frame/overlay/ED docs',
    );
    // shared relevance: at least one overlap in top results
    assert.ok([...aSlugs].some((s) => b.some((r) => r.slug === s)));
  });

  it('finds fall lifecycle ED for 낙상 상태 머신', async () => {
    const index = await loadSearchIndex();
    const results = searchDocumentsInIndex(index, '낙상 상태 머신', { limit: 12 });
    assert.ok(results.some((r) => r.slug === 'ED-Fall-Faint-Lifecycle'));
  });

  it('finds MQTT path for mqtt 이벤트', async () => {
    const index = await loadSearchIndex();
    const results = searchDocumentsInIndex(index, 'MQTT 이벤트 경로', { limit: 12 });
    assert.ok(results.some((r) => r.slug === 'ED-MQTT-Backend-Event-Path'));
  });

  it('does not cap at 8 only — returns more when available', async () => {
    const index = await loadSearchIndex();
    const results = searchDocumentsInIndex(index, 'camera', { limit: 24 });
    assert.ok(results.length > 8 || results.length === index.filter((d) =>
      normalizeSearchText(`${d.title} ${d.text}`).includes('camera'),
    ).length);
  });

  it('title match beats pure high body frequency noise for exact nav phrase', async () => {
    const index = await loadSearchIndex();
    const q = tokenizeQuery('실시간 프레임 지연 제어');
    assert.ok(q.tokens.length > 0);
    const results = searchDocumentsInIndex(index, '실시간 프레임 지연 제어', { limit: 5 });
    assert.ok(results.length > 0);
    assert.equal(results[0].slug, 'ED-Latest-Frame-Queue-Policy');
    assert.ok(results[0].matchReasons?.includes('제목 일치'));
  });

  it('includes snippet on hits', async () => {
    const index = await loadSearchIndex();
    const results = searchDocumentsInIndex(index, 'CameraFrameQueue', { limit: 5 });
    assert.ok(results.length > 0);
    assert.ok(typeof results[0].snippet === 'string');
  });
});
