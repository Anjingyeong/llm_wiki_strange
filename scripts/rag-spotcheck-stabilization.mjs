/**
 * RAG 4-question spot-check (stabilization pass). Run after rag:index:
 *   node scripts/rag-spotcheck-stabilization.mjs
 */
import { readFile } from 'node:fs/promises';
import { searchRelevantChunks } from './lib/rag/search.mjs';

const indexPath = new URL('../data/ragVectorIndex.json', import.meta.url);
const index = JSON.parse(await readFile(indexPath, 'utf8'));

const cases = [
  {
    id: 'tensorrt',
    question: 'TensorRT offline 3000 frames 195.87 FPS YOLO 3.82ms 112.26 PyTorch benchmark',
    expectAny: ['Benchmark-Evidence-Hub', 'Evidence-TensorRT-Adoption-Decision'],
  },
  {
    id: '54d',
    question: '54D motion feature F1 93.49 False Negative 108 to 66 center_drop velocity torso_angle',
    expectAny: ['Feature-Vector-51D-vs-54D', 'Benchmark-Evidence-Hub'],
  },
  {
    id: 'vlm',
    question: 'VLM clip 8 frames memory deidentify POST internal vlm jobs gemini-embedding-001 vlmDescription LIKE',
    expectAny: ['VLM-RAG-DBless-Mock-MVP', 'Benchmark-Evidence-Hub', 'Evidence-VLM-RAG-Event-Search-Decision'],
  },
  {
    id: 'mqtt-e2e',
    question: 'MQTT End-to-End alert latency 20.931ms p95 26ms 29 events 1 second SLA',
    expectAny: ['Evidence-MQTT-E2E-Alert-Latency', 'Benchmark-Evidence-Hub'],
  },
];

let failed = 0;
for (const c of cases) {
  const hits = searchRelevantChunks(index, c.question, { limit: 8 });
  const ids = new Set(hits.map((h) => h.documentId ?? h.docId ?? h.id).filter(Boolean));
  const ok = c.expectAny.some((e) => [...ids].some((id) => String(id).includes(e.replace('.md', '')) || String(id) === e));
  const top = [...ids].slice(0, 5).join(', ') || '(none)';
  console.log(`${ok ? 'PASS' : 'FAIL'} [${c.id}] top doc ids: ${top}`);
  if (!ok) {
    failed += 1;
    console.log(`  expected one of: ${c.expectAny.join(', ')}`);
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${cases.length} failed — run npm run rag:index first.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} stabilization RAG spot-checks passed.`);