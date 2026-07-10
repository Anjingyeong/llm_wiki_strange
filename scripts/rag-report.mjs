#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = join(ROOT, 'rag-evaluation/runs');

async function main() {
  const runId = process.argv[2];
  let target = runId;
  if (!target) {
    const entries = (await readdir(runsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    target = entries.at(-1);
  }
  if (!target) {
    console.error('No runs found. Execute npm run rag:eval first.');
    process.exitCode = 1;
    return;
  }
  const reportPath = join(runsDir, target, 'report.md');
  const metricsPath = join(runsDir, target, 'metrics.json');
  const report = await readFile(reportPath, 'utf8');
  const metrics = JSON.parse(await readFile(metricsPath, 'utf8'));
  console.log(report);
  console.log('\n--- metrics.json (summary) ---');
  console.log(JSON.stringify({
    hitAt1: metrics.hitAt1,
    hitAt5: metrics.hitAt5,
    recallAt5: metrics.recallAt5,
    mrr: metrics.mrr,
    ndcgAt5: metrics.ndcgAt5,
    noResultAccuracy: metrics.noResultAccuracy,
    p95LatencyMs: metrics.p95LatencyMs,
    failureTaxonomy: metrics.failureTaxonomy,
  }, null, 2));
  console.log(`\nrun: rag-evaluation/runs/${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
