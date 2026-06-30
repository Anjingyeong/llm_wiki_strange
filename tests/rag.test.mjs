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
      slug: 'WebRTC-vs-HLS',
      title: 'WebRTC vs HLS',
      updatedAt: '2026-06-26',
    },
  ]);

  assert.equal(index.chunks.length, 1);
  assert.equal(index.chunks[0].documentId, 'WebRTC-vs-HLS');
  assert.equal(index.chunks[0].section, 'WebRTC 선택');
  assert.ok(index.chunks[0].embedding.length > 0);
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
