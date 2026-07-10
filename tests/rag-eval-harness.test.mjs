import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { hitAtK, mrrAtK, ndcgAtK, recallAtK } from '../scripts/lib/rag-eval/metrics.mjs';
import { classifyFailures } from '../scripts/lib/rag-eval/taxonomy.mjs';
import { evaluatePromotion } from '../scripts/lib/rag-eval/promotion.mjs';
import { parseSimpleYaml } from '../scripts/lib/rag-eval/yaml.mjs';

test('golden dataset has at least 50 queries and balanced categories', async () => {
  const text = await readFile(new URL('../rag-evaluation/datasets/golden_queries.v1.jsonl', import.meta.url), 'utf8');
  const rows = text.trim().split(/\n/).map((line) => JSON.parse(line));
  assert.ok(rows.length >= 50, `expected >=50 queries, got ${rows.length}`);
  const categories = new Set(rows.map((row) => row.category));
  for (const required of ['exact-term', 'paraphrase', 'decision', 'multi-doc', 'filter', 'unanswerable', 'conflict', 'mixed-lang']) {
    assert.ok(categories.has(required), `missing category ${required}`);
  }
  assert.ok(rows.some((row) => row.answerable === false));
});

test('metrics helpers compute hit/mrr/ndcg', () => {
  const retrieved = ['A', 'B', 'C', 'D', 'E'];
  const expected = ['C', 'Z'];
  assert.equal(hitAtK(retrieved, expected, 1), 0);
  assert.equal(hitAtK(retrieved, expected, 3), 1);
  assert.equal(recallAtK(retrieved, expected, 5), 0.5);
  assert.equal(mrrAtK(retrieved, expected, 5), 1 / 3);
  assert.ok(ndcgAtK(retrieved, expected, 5) > 0);
});

test('taxonomy flags missing expected docs', () => {
  const failures = classifyFailures(
    { expectedDocumentSlugs: ['A'], expectedKeywords: ['foo'], answerable: true, filters: {} },
    ['B', 'C'],
    [{ documentId: 'B', score: 0.5, text: 'bar' }],
    0,
  );
  assert.ok(failures.some((failure) => failure.code === 'EXPECTED_DOC_NOT_RETRIEVED'));
});

test('promotion policy requires quality gain without large regression', () => {
  const policy = parseSimpleYaml(`
minRecallOrMrrDelta: 0.01
maxQualityRegression: 0.02
maxNoResultAccuracyRegression: 0.02
maxP95LatencyIncreaseRatio: 0.3
forbidDuplicateIncrease: true
qualityMetrics:
  - hitAt5
  - mrr
`);
  const best = { hitAt5: 0.5, mrr: 0.4, recallAt5: 0.45, noResultAccuracy: 0.9, p95LatencyMs: 10, duplicateIncidentOrDocumentCount: 0 };
  const good = { hitAt5: 0.52, mrr: 0.42, recallAt5: 0.5, noResultAccuracy: 0.9, p95LatencyMs: 11, duplicateIncidentOrDocumentCount: 0 };
  const bad = { hitAt5: 0.3, mrr: 0.2, recallAt5: 0.3, noResultAccuracy: 0.5, p95LatencyMs: 50, duplicateIncidentOrDocumentCount: 3 };
  assert.equal(evaluatePromotion(good, best, policy).promote, true);
  assert.equal(evaluatePromotion(bad, best, policy).promote, false);
});

test('rag:eval script exits 0 and writes run artifacts', async () => {
  const cwd = process.cwd();
  const result = spawnSync(process.execPath, ['scripts/rag-eval.mjs'], {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const runs = await readdir(join(cwd, 'rag-evaluation/runs'));
  assert.ok(runs.length >= 1);
});
