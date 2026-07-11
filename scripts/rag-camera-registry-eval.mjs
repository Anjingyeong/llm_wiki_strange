/**
 * Camera registry / hardcoding paraphrase evaluation (hybrid).
 * Usage: node scripts/rag-camera-registry-eval.mjs [outJson]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { answerQuestionFromIndex, expandQuery } from './lib/rag/answer.mjs';
import { searchRelevantChunks } from './lib/rag/search.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = process.argv[2] || join(root, 'rag-evaluation/experiments/camera-registry-eval-latest.json');
const ragIndex = JSON.parse(await readFile(join(root, 'data/ragVectorIndex.json'), 'utf8'));
const rowsRaw = (await readFile(join(root, 'rag-evaluation/datasets/camera_registry_queries.v1.jsonl'), 'utf8'))
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const mode = 'hybrid';
const rows = [];
const latencies = [];

for (const item of rowsRaw) {
  const t0 = performance.now();
  const expanded = expandQuery(item.query);
  const chunks = searchRelevantChunks(ragIndex, expanded, { mode, limit: 10 });
  const answer = await answerQuestionFromIndex(ragIndex, item.query, { mode });
  const t1 = performance.now();
  latencies.push(t1 - t0);
  const topSlugs = chunks.map((c) => c.slug || c.documentId);
  const top3 = topSlugs.slice(0, 3);
  const expected = item.expectedSlugs || [];
  const hitTop1 = expected.length ? expected.includes(topSlugs[0]) : null;
  const hitTop3 = expected.length ? expected.some((e) => top3.includes(e)) : null;
  const statusOk = answer.status === (item.expect?.status || (item.group === 'answerable' ? 'answered' : 'insufficient_context'));
  const supportedOk = item.expect?.answerSupported === false
    ? answer.answerSupported !== true && answer.status === 'insufficient_context'
    : item.expect?.answerSupported === true
      ? answer.answerSupported === true && answer.status === 'answered'
      : true;
  const top3Ok = item.expect?.top3Expected ? hitTop3 === true : true;
  const pass = statusOk && supportedOk && top3Ok;
  rows.push({
    id: item.id,
    group: item.group,
    query: item.query,
    status: answer.status,
    retrievalRelevant: answer.retrievalRelevant ?? null,
    answerSupported: answer.answerSupported ?? null,
    abstentionReason: answer.abstentionReason ?? null,
    top1: topSlugs[0] ?? null,
    top3,
    hitTop1,
    hitTop3,
    pass,
    latencyMs: Number((t1 - t0).toFixed(3)),
  });
}

latencies.sort((a, b) => a - b);
const ans = rows.filter((r) => r.group === 'answerable');
const un = rows.filter((r) => r.group === 'unanswerable');
const report = {
  generatedAt: new Date().toISOString(),
  mode,
  answerable: {
    total: ans.length,
    pass: ans.filter((r) => r.pass).length,
    top1: ans.filter((r) => r.hitTop1).length,
    top3: ans.filter((r) => r.hitTop3).length,
  },
  unanswerable: {
    total: un.length,
    pass: un.filter((r) => r.pass).length,
    falseAnswers: un.filter((r) => r.status === 'answered').map((r) => r.query),
  },
  latency: {
    p50: Number(latencies[Math.floor(0.5 * (latencies.length - 1))].toFixed(3)),
    p95: Number(latencies[Math.floor(0.95 * (latencies.length - 1))].toFixed(3)),
  },
  rows,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({
  answerable: report.answerable,
  unanswerable: report.unanswerable,
  latency: report.latency,
  fails: rows.filter((r) => !r.pass),
  outPath,
}, null, 2));
