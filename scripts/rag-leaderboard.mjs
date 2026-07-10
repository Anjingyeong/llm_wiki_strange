#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const path = join(ROOT, 'rag-evaluation/leaderboard.csv');
  const text = await readFile(path, 'utf8');
  console.log(text.trimEnd());
  try {
    const best = JSON.parse(await readFile(join(ROOT, 'rag-evaluation/best.json'), 'utf8'));
    console.log('\n--- best.json ---');
    console.log(JSON.stringify({
      runId: best.runId,
      experimentName: best.experimentName,
      hitAt5: best.metrics?.hitAt5,
      recallAt5: best.metrics?.recallAt5,
      mrr: best.metrics?.mrr,
      p95LatencyMs: best.metrics?.p95LatencyMs,
    }, null, 2));
  } catch {
    console.log('\n(no best.json yet)');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
