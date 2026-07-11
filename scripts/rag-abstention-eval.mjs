/**
 * Abstention / unanswerable evaluation for hybrid RAG.
 * Usage: node scripts/rag-abstention-eval.mjs [outJsonPath]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { answerQuestionFromIndex } from './lib/rag/answer.mjs';
import { searchRelevantChunks } from './lib/rag/search.mjs';
import { expandQuery } from './lib/rag/answer.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv[2];
const outPath =
  outArg
  || join(root, 'rag-evaluation/experiments/abstention-eval-latest.json');

const related = [
  { q: '왜 오래된 RTSP 프레임을 버리나요?', expected: ['ED-Latest-Frame-Queue-Policy'] },
  { q: '낙상 알림이 계속 반복되는 문제는 어떻게 해결했나요?', expected: ['ED-Fall-Faint-Lifecycle'] },
  { q: 'frameId는 왜 필요한가요?', expected: ['ED-FrameId-Evidence-Overlay-Sync', 'Frame-Sync-Debug-Report'] },
  { q: '영상과 AI Overlay가 어긋나는 이유는 무엇인가요?', expected: ['ED-FrameId-Evidence-Overlay-Sync', 'Frame-Matching-Report'] },
  { q: 'TensorRT가 실제 worker에 적용됐나요?', expected: ['Evidence-TensorRT-Adoption-Decision'] },
  { q: 'PyTorch와 TensorRT 성능 차이는 무엇인가요?', expected: ['Evidence-TensorRT-Adoption-Decision'] },
  { q: '영상이 끝난 뒤 이전 상태가 남지 않게 어떻게 처리했나요?', expected: ['Multi-Camera-Worker-Session-Reliability'] },
  { q: '카메라는 하드코딩되어 있나요?', expected: ['Multi-Camera-Worker-Session-Reliability', 'Realtime-Camera-Runtime-Stabilization'] },
  { q: 'MQTT 이벤트가 DB와 프론트까지 어떻게 전달되나요?', expected: ['ED-MQTT-Backend-Event-Path', 'MQTT-Event-Schema'] },
  { q: '언제 어디서 누가 넘어졌는지 검색하는 기능은 구현됐나요?', expected: ['Evidence-VLM-RAG-Event-Search-Decision', 'VLM-RAG-DBless-Mock-MVP', 'ED-Snapshot-VLM-Side-Channel'] },
];

const ragIndex = JSON.parse(await readFile(join(root, 'data/ragVectorIndex.json'), 'utf8'));
const unanswerableRaw = await readFile(
  join(root, 'rag-evaluation/datasets/unanswerable_queries.v1.jsonl'),
  'utf8',
);
const unanswerable = unanswerableRaw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const mode = 'hybrid';
const latencies = [];
const relatedRows = [];
const unRows = [];

function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx];
}

for (const item of related) {
  const t0 = performance.now();
  const expanded = expandQuery(item.q);
  const chunks = searchRelevantChunks(ragIndex, expanded, { mode, limit: 6 });
  const answer = await answerQuestionFromIndex(ragIndex, item.q, { mode });
  const t1 = performance.now();
  const latency = t1 - t0;
  latencies.push(latency);
  const topSlugs = (chunks || []).map((c) => c.slug || c.documentId);
  const sourceSlugs = (answer.sources || []).map((s) => s.slug);
  const top1 = topSlugs[0] ?? sourceSlugs[0] ?? null;
  const top3 = (topSlugs.length ? topSlugs : sourceSlugs).slice(0, 3);
  const hitTop1 = item.expected.includes(top1);
  const hitTop3 = item.expected.some((e) => top3.includes(e) || sourceSlugs.includes(e));
  let rank = 0;
  for (let i = 0; i < top3.length; i++) {
    if (item.expected.includes(top3[i])) {
      rank = i + 1;
      break;
    }
  }
  relatedRows.push({
    question: item.q,
    expected: item.expected,
    status: answer.status,
    retrievalRelevant: answer.retrievalRelevant ?? null,
    answerSupported: answer.answerSupported ?? null,
    top1,
    top3,
    hitTop1,
    hitTop3,
    rank,
    latencyMs: Number(latency.toFixed(3)),
    abstentionReason: answer.abstentionReason ?? null,
  });
}

for (const item of unanswerable) {
  const t0 = performance.now();
  const answer = await answerQuestionFromIndex(ragIndex, item.query, { mode });
  const t1 = performance.now();
  latencies.push(t1 - t0);
  const sources = answer.sources || [];
  const expectStatus = item.expect.status || 'insufficient_context';
  const statusOk = answer.status === expectStatus;
  // answerSupported must not be true when expect says false
  const supportedOk = item.expect.answerSupported === false
    ? answer.status === 'insufficient_context' && answer.answerSupported !== true
    : true;
  const sourcesEmptyOk = item.expect.sourcesEmpty
    ? sources.length === 0
    : true;
  // Fully off-domain: retrievalRelevant false and empty sources preferred
  const retrievalOk = item.expect.retrievalRelevant === false
    ? (answer.retrievalRelevant === false && sources.length === 0)
    : true;
  // False answer: model/status answered when dataset forbids a factual invent
  const falseAnswer =
    answer.status === 'answered'
    && (
      item.expect.falseAnswerForbidden
      || item.group === 'C'
      || item.group === 'A'
      || item.expect.answerSupported === false
    );
  const pass = statusOk && supportedOk && sourcesEmptyOk && retrievalOk && !falseAnswer;
  unRows.push({
    id: item.id,
    group: item.group,
    query: item.query,
    status: answer.status,
    retrievalRelevant: answer.retrievalRelevant ?? null,
    answerSupported: answer.answerSupported ?? null,
    sourcesCount: sources.length,
    abstentionReason: answer.abstentionReason ?? null,
    falseAnswer,
    pass,
    latencyMs: Number((t1 - t0).toFixed(3)),
  });
}

latencies.sort((a, b) => a - b);
const mrr =
  relatedRows.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / (relatedRows.length || 1);

const byGroup = {};
for (const g of ['A', 'B', 'C']) {
  const rows = unRows.filter((r) => r.group === g);
  byGroup[g] = {
    total: rows.length,
    pass: rows.filter((r) => r.pass).length,
    insufficient: rows.filter((r) => r.status === 'insufficient_context').length,
    falseAnswers: rows.filter((r) => r.falseAnswer).length,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  mode,
  related10: {
    top1: relatedRows.filter((r) => r.hitTop1).length,
    top3: relatedRows.filter((r) => r.hitTop3).length,
    total: relatedRows.length,
    mrr: Number(mrr.toFixed(4)),
    answered: relatedRows.filter((r) => r.status === 'answered').length,
    insufficient: relatedRows.filter((r) => r.status === 'insufficient_context').length,
    falseRejections: relatedRows.filter((r) => r.status === 'insufficient_context').map((r) => r.question),
    misses: relatedRows.filter((r) => !r.hitTop3).map((r) => ({
      q: r.question,
      top3: r.top3,
      status: r.status,
    })),
    rows: relatedRows,
  },
  unanswerable: {
    total: unRows.length,
    pass: unRows.filter((r) => r.pass).length,
    accuracy: unRows.length
      ? Number((unRows.filter((r) => r.pass).length / unRows.length).toFixed(4))
      : 0,
    insufficient_context: unRows.filter((r) => r.status === 'insufficient_context').length,
    falseAnswers: unRows.filter((r) => r.falseAnswer).map((r) => r.query),
    byGroup,
    rows: unRows,
  },
  latency: {
    p50: Number(percentile(latencies, 0.5).toFixed(3)),
    p95: Number(percentile(latencies, 0.95).toFixed(3)),
    mean: Number((latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(3)),
  },
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');

const summary = {
  relatedTop1: `${report.related10.top1}/${report.related10.total}`,
  relatedTop3: `${report.related10.top3}/${report.related10.total}`,
  mrr: report.related10.mrr,
  unanswerable: `${report.unanswerable.pass}/${report.unanswerable.total} (${report.unanswerable.accuracy})`,
  byGroup: report.unanswerable.byGroup,
  falseAnswers: report.unanswerable.falseAnswers.length,
  falseRejections: report.related10.falseRejections,
  latency: report.latency,
  outPath,
};
console.log(JSON.stringify(summary, null, 2));
