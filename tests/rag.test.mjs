import assert from 'node:assert/strict';
import test from 'node:test';

import {
  answerQuestionFromIndex,
  buildRagIndex,
  searchRelevantChunks,
} from '../scripts/lib/rag-core.mjs';

test('Given wiki markdown When building the RAG index Then chunks include source metadata and embeddings', () => {
  const index = buildRagIndex([
    {
      body: '## WebRTC 선택\nWebRTC는 WHEP 경로로 1초 이하 지연을 목표로 한다.',
      category: 'Frontend',
      order: 430,
      sourcePath: 'content/WebRTC-vs-HLS.md',
      slug: 'WebRTC-vs-HLS',
      tags: ['streaming'],
      title: 'WebRTC vs HLS',
      updatedAt: '2026-06-26',
    },
  ]);

  assert.equal(index.chunks.length, 1);
  assert.equal(index.chunks[0].documentId, 'WebRTC-vs-HLS');
  assert.equal(index.chunks[0].section, 'WebRTC 선택');
  assert.equal(index.chunks[0].sectionTitle, 'WebRTC 선택');
  assert.equal(index.chunks[0].sourcePath, 'content/WebRTC-vs-HLS.md');
  assert.deepEqual(index.chunks[0].tags, ['streaming']);
  assert.equal(index.chunks[0].metadata.order, 430);
  assert.ok(index.chunks[0].embedding.length > 0);
});

test('Given exact code keywords When searching hybrid RAG Then BM25 and RRF surface the matching document with reasons', () => {
  const index = buildRagIndex([
    {
      body: '## Runtime\nrun_registered_cameras.py assigns cameraLoginId dynamically for active camera workers.',
      category: 'Infra',
      order: 810,
      sourcePath: 'content/Runtime.md',
      slug: 'Runtime',
      tags: ['streaming', 'runtime'],
      title: 'Runtime Stabilization',
      updatedAt: '2026-07-01',
    },
    {
      body: '## Model\nYOLO26n was selected for pose extraction.',
      category: 'AI Pipeline',
      order: 310,
      sourcePath: 'content/Model.md',
      slug: 'Model',
      tags: ['model'],
      title: 'Model Decision',
      updatedAt: '2026-06-26',
    },
  ]);

  const results = searchRelevantChunks(index, 'cameraLoginId run_registered_cameras.py', {
    debug: true,
    limit: 3,
  });

  assert.equal(results[0].documentId, 'Runtime');
  assert.ok(results[0].matchedBy.includes('bm25'));
  assert.ok(results[0].matchedBy.includes('rrf'));
  assert.equal(results.debug.query, 'cameraLoginId run_registered_cameras.py');
  assert.ok(results.debug.bm25Results.some((result) => result.documentId === 'Runtime'));
  assert.ok(results.debug.rrfResults.some((result) => result.documentId === 'Runtime'));
});

test('Given an overlay streaming question When searching without explicit filters Then inferred metadata filters prioritize relevant categories', () => {
  const index = buildRagIndex([
    {
      body: '## Overlay\nOverlaySyncBuffer aligns frameId and capturedAtMs for RTSP overlay drift.',
      category: 'Bugs',
      order: 710,
      sourcePath: 'content/Bug-Overlay.md',
      slug: 'Bug-Overlay',
      tags: ['overlay', 'streaming'],
      title: 'Overlay Drift Bug',
      updatedAt: '2026-07-02',
    },
    {
      body: '## Resume\nInterview notes and portfolio wording.',
      category: '면접·이력서 정리',
      order: 910,
      sourcePath: 'content/Resume.md',
      slug: 'Resume',
      tags: ['resume'],
      title: 'Resume Notes',
      updatedAt: '2026-06-26',
    },
  ]);

  const results = searchRelevantChunks(index, 'RTSP overlay 밀림', {
    debug: true,
    limit: 2,
  });

  assert.equal(results[0].documentId, 'Bug-Overlay');
  assert.ok(results.debug.inferredFilters.categories.includes('Bugs'));
  assert.ok(results.debug.inferredFilters.tags.includes('overlay'));
});

test('Given indexed wiki chunks When asking a grounded question Then answer cites matching documents only', async () => {
  const index = buildRagIndex([
    {
      body: '## Decision\n기본 pose extractor는 yolo26n-pose.pt로 둔다. 판단 기준은 Faint Recall 1순위다.',
      category: 'ADR',
      slug: 'ADR-003-YOLO26n-Selection',
      title: 'ADR-003 YOLO26n Selection',
      updatedAt: '2026-06-26',
    },
  ]);

  const result = await answerQuestionFromIndex(index, '기본 pose extractor는 무엇이고 근거는?', {
    allowExternalLlm: false,
  });

  assert.equal(result.status, 'answered');
  assert.match(result.answer, /yolo26n-pose/);
  assert.match(result.answer, /Faint Recall/);
  assert.equal(result.sources[0].documentId, 'ADR-003-YOLO26n-Selection');
  assert.equal(result.contextChunks[0].title, 'ADR-003 YOLO26n Selection');
  assert.equal(result.contextChunks[0].category, 'ADR');
  assert.equal(result.contextChunks[0].sourcePath, 'content/ADR-003-YOLO26n-Selection.md');
  assert.ok(result.debugInfo.finalContextChunks.length > 0);
});

test('Given no relevant chunks When asking unrelated question Then response refuses to guess', async () => {
  const index = buildRagIndex([
    {
      body: '## Decision\nWebRTC는 실시간 관제 재생의 기본 경로다.',
      category: 'ADR',
      slug: 'ADR-001-WebRTC',
      title: 'ADR-001 WebRTC',
      updatedAt: '2026-06-26',
    },
  ]);

  const results = searchRelevantChunks(index, '급여 정책은 어떻게 되나요?');
  const answer = await answerQuestionFromIndex(index, '급여 정책은 어떻게 되나요?', {
    allowExternalLlm: false,
  });

  assert.equal(results.length, 0);
  assert.equal(answer.status, 'insufficient_context');
  assert.match(answer.answer, /관련 문서가 부족함|문서에서 확인되지 않음/);
  assert.equal(answer.sources.length, 0);
});
