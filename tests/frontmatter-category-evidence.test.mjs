import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WIKI_FRONTMATTER_CATEGORIES } from '../src/lib/wikiCategories.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

assert.ok(
  WIKI_FRONTMATTER_CATEGORIES.includes('Evidence'),
  'WIKI_FRONTMATTER_CATEGORIES must include Evidence',
);

const evidenceDocs = [
  'Benchmark-Evidence-Hub.md',
  'Evidence-MQTT-E2E-Alert-Latency.md',
  'Evidence-RTSP-2Cam-Queue-TensorRT.md',
  'Tracking-Association-Stabilization.md',
  'Tracking-Association-Offline-AB-2026-07-13.md',
];

for (const file of evidenceDocs) {
  const raw = readFileSync(join(root, 'content', file), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, `${file} must have frontmatter`);
  assert.match(m[1], /^category:\s*Evidence\s*$/m, `${file} category must be Evidence`);
}

console.log('frontmatter Evidence category OK');