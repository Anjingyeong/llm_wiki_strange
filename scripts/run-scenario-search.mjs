/**
 * Multi-mode offline scenario: client search + RAG (baseline/lexical/hybrid/hybrid-raw).
 * Default output: rag-evaluation/experiments/scenario-search-latest.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { NO_RESULT_THRESHOLD, searchDocumentsInIndex } from '../src/lib/searchCore.mjs';
import { answerQuestionFromIndex } from './lib/rag-core.mjs';
import { searchRelevantChunks } from './lib/rag/search.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOut = join(root, 'rag-evaluation/experiments/scenario-search-latest.json');
const outPath = process.argv[2] || defaultOut;

const MODES = ['baseline', 'lexical', 'hybrid', 'hybrid-raw'];

const questions = [
  { q: '왜 오래된 RTSP 프레임을 버리나요?', expected: ['ED-Latest-Frame-Queue-Policy'], related: true },
  { q: '낙상 알림이 계속 반복되는 문제는 어떻게 해결했나요?', expected: ['ED-Fall-Faint-Lifecycle'], related: true },
  { q: 'frameId는 왜 필요한가요?', expected: ['ED-FrameId-Evidence-Overlay-Sync', 'Frame-Sync-Debug-Report'], related: true },
  { q: '영상과 AI Overlay가 어긋나는 이유는 무엇인가요?', expected: ['ED-FrameId-Evidence-Overlay-Sync', 'Frame-Matching-Report'], related: true },
  { q: 'TensorRT가 실제 worker에 적용됐나요?', expected: ['Evidence-TensorRT-Adoption-Decision'], related: true },
  { q: 'PyTorch와 TensorRT 성능 차이는 무엇인가요?', expected: ['Evidence-TensorRT-Adoption-Decision'], related: true },
  { q: '영상이 끝난 뒤 이전 상태가 남지 않게 어떻게 처리했나요?', expected: ['Multi-Camera-Worker-Session-Reliability'], related: true },
  { q: '카메라는 하드코딩되어 있나요?', expected: ['Multi-Camera-Worker-Session-Reliability', 'Realtime-Camera-Runtime-Stabilization'], related: true },
  { q: 'MQTT 이벤트가 DB와 프론트까지 어떻게 전달되나요?', expected: ['ED-MQTT-Backend-Event-Path', 'MQTT-Event-Schema'], related: true },
  { q: '언제 어디서 누가 넘어졌는지 검색하는 기능은 구현됐나요?', expected: ['Evidence-VLM-RAG-Event-Search-Decision', 'VLM-RAG-DBless-Mock-MVP', 'ED-Snapshot-VLM-Side-Channel'], related: true },
];

const unrelated = [
  { q: '직원 급여 정책', expected: [], related: false },
  { q: '회사 연차 규정', expected: [], related: false },
  { q: '쿠버네티스 장애 대응', expected: [], related: false },
  { q: '블록체인 합의 알고리즘', expected: [], related: false },
  { q: '의료보험 청구 방식', expected: [], related: false },
];

const searchBundle = JSON.parse(await readFile(join(root, 'src/generated/searchIndex.json'), 'utf8'));
const searchIndex = Array.isArray(searchBundle) ? searchBundle : (searchBundle.documents ?? []);
const ragIndex = JSON.parse(await readFile(join(root, 'data/ragVectorIndex.json'), 'utf8'));

function chunkSlug(c) {
  return c?.slug || c?.documentSlug || c?.documentId || null;
}

function packChunks(chunks) {
  const top = (chunks || []).slice(0, 3);
  return {
    top1: chunkSlug(top[0]),
    top3: top.map(chunkSlug).filter(Boolean),
    matchedBy: top.map((c) => c.matchedBy ?? []),
    vectorScore: top.map((c) => c.vectorScore ?? c.rawScore ?? null),
    lexicalScore: top.map((c) => c.lexicalScore ?? null),
    finalScore: top.map((c) => c.score ?? null),
  };
}

const allItems = [...questions, ...unrelated];
const byMode = {};

for (const mode of MODES) {
  const rows = [];
  for (const item of allItems) {
    const t0 = performance.now();
    const front = searchDocumentsInIndex(searchIndex, item.q, {
      limit: 3,
      minScore: NO_RESULT_THRESHOLD,
    });
    const t1 = performance.now();
    const chunks = searchRelevantChunks(ragIndex, item.q, { mode, limit: 6 });
    const packed = packChunks(chunks);
    const answer = await answerQuestionFromIndex(ragIndex, item.q, { mode, debug: false });
    const t2 = performance.now();
    const ragTop = (answer.sources || []).slice(0, 3).map((s) => s.slug);
    const frontTop = front.map((r) => r.slug);
    const expectedHit = item.related
      ? item.expected.some((e) => ragTop.includes(e) || packed.top3.includes(e))
      : answer.status === 'insufficient_context' || ragTop.length === 0;
    const frontHit = item.related
      ? item.expected.some((e) => frontTop.includes(e))
      : frontTop.length === 0;

    rows.push({
      question: item.q,
      related: item.related,
      expected: item.expected,
      frontTop3: frontTop,
      frontHit,
      frontLatencyMs: Number((t1 - t0).toFixed(3)),
      mode,
      top1: packed.top1 ?? ragTop[0] ?? null,
      top3: packed.top3.length ? packed.top3 : ragTop,
      expectedHit,
      matchedBy: packed.matchedBy,
      vectorScore: packed.vectorScore,
      lexicalScore: packed.lexicalScore,
      finalScore: packed.finalScore,
      insufficient_context: answer.status === 'insufficient_context',
      ragStatus: answer.status,
      ragTop3: ragTop,
      latencyMs: Number((t2 - t1).toFixed(3)),
    });
  }
  byMode[mode] = {
    relatedHits: rows.filter((r) => r.related && r.expectedHit).length,
    relatedTotal: rows.filter((r) => r.related).length,
    noAnswerCorrect: rows.filter((r) => !r.related && r.insufficient_context).length,
    noAnswerTotal: rows.filter((r) => !r.related).length,
    frontRelatedHits: rows.filter((r) => r.related && r.frontHit).length,
    frontNoResultCorrect: rows.filter((r) => !r.related && r.frontTop3.length === 0).length,
    rows,
  };
}

const failures = [];
for (const mode of MODES) {
  for (const row of byMode[mode].rows) {
    if (row.related && !row.expectedHit) {
      failures.push({ mode, question: row.question, top3: row.top3, reason: 'expected_doc_miss' });
    }
    if (!row.related && !row.insufficient_context) {
      failures.push({
        mode,
        question: row.question,
        top3: row.top3,
        reason: 'false_positive_answer',
        status: row.ragStatus,
      });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  noResultThreshold: NO_RESULT_THRESHOLD,
  modes: MODES,
  byMode,
  failures,
  summary: Object.fromEntries(
    MODES.map((m) => [
      m,
      {
        relatedHits: byMode[m].relatedHits,
        relatedTotal: byMode[m].relatedTotal,
        noAnswerCorrect: byMode[m].noAnswerCorrect,
        noAnswerTotal: byMode[m].noAnswerTotal,
        frontRelatedHits: byMode[m].frontRelatedHits,
        frontNoResultCorrect: byMode[m].frontNoResultCorrect,
      },
    ]),
  ),
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outPath, summary: report.summary, failureCount: failures.length }, null, 2));
