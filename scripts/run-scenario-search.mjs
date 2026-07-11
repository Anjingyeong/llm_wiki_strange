/**
 * Offline scenario check: client search + RAG sources for fixed questions.
 * Writes JSON report to stdout.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { searchDocumentsInIndex } from '../src/lib/searchCore.mjs';
import { answerQuestionFromIndex } from './lib/rag-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = process.argv[2] || join(root, 'rag-evaluation/experiments/scenario-search-latest.json');

const questions = [
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

const searchIndex = JSON.parse(await readFile(join(root, 'src/generated/searchIndex.json'), 'utf8'));
const ragIndex = JSON.parse(await readFile(join(root, 'data/ragVectorIndex.json'), 'utf8'));

const rows = [];
for (const item of questions) {
  const t0 = performance.now();
  const front = searchDocumentsInIndex(searchIndex, item.q, { limit: 3 });
  const t1 = performance.now();
  const rag = await answerQuestionFromIndex(ragIndex, item.q, { mode: 'baseline', debug: false });
  const t2 = performance.now();
  const ragTop = (rag.sources || []).slice(0, 3).map((s) => s.slug);
  const frontTop = front.map((r) => r.slug);
  const frontHit = item.expected.some((e) => frontTop.includes(e));
  const ragHit = item.expected.some((e) => ragTop.includes(e));
  rows.push({
    question: item.q,
    expected: item.expected,
    frontTop3: frontTop,
    frontReasons: front.map((r) => r.matchReasons),
    frontLatencyMs: Number((t1 - t0).toFixed(3)),
    ragTop3: ragTop,
    ragStatus: rag.status,
    ragLatencyMs: Number((t2 - t1).toFixed(3)),
    frontHit,
    ragHit,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  frontHits: rows.filter((r) => r.frontHit).length,
  ragHits: rows.filter((r) => r.ragHit).length,
  total: rows.length,
  rows,
};

await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outPath, frontHits: report.frontHits, ragHits: report.ragHits, total: report.total }, null, 2));
