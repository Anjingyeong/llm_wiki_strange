import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { answerQuestionFromIndex, searchRelevantChunks } from '../scripts/lib/rag-core.mjs';

const index = JSON.parse(await readFile(new URL('../data/ragVectorIndex.json', import.meta.url), 'utf8'));
const evaluationCases = JSON.parse(
  await readFile(new URL('./fixtures/rag-evaluation.json', import.meta.url), 'utf8'),
);

test('Given the generated RAG index When evaluating representative questions Then expected documents appear in top-k', () => {
  assert.ok(evaluationCases.length >= 10);

  for (const evaluationCase of evaluationCases) {
    assert.equal(typeof evaluationCase.question, 'string');
    assert.equal(typeof evaluationCase.expectedAnswer, 'string');
    assert.ok(evaluationCase.expectedAnswer.length > 20);
    assert.ok(Array.isArray(evaluationCase.expectedDocumentIds));
    assert.ok(evaluationCase.expectedDocumentIds.length > 0);

    const results = searchRelevantChunks(index, evaluationCase.question, { limit: evaluationCase.topK });
    const actualDocumentIds = results.map((result) => result.documentId);
    const hasExpectedDocument = evaluationCase.expectedDocumentIds.some((documentId) =>
      actualDocumentIds.includes(documentId),
    );

    assert.ok(
      hasExpectedDocument,
      [
        `case: ${evaluationCase.id}`,
        `topic: ${evaluationCase.topic}`,
        `expected one of: ${evaluationCase.expectedDocumentIds.join(', ')}`,
        `actual: ${actualDocumentIds.join(', ')}`,
      ].join('\n'),
    );
  }
});

test('Given questions outside the wiki corpus When answering Then RAG refuses to invent unsupported facts', async () => {
  const unsupportedQuestions = [
    'xylophone zeppelin nebula cafeteria payroll reimbursement',
    'quantum sandwich lunar chess warranty florist',
  ];

  for (const question of unsupportedQuestions) {
    const answer = await answerQuestionFromIndex(index, question, { allowExternalLlm: false });

    assert.equal(answer.status, 'insufficient_context');
    assert.equal(answer.sources.length, 0);
  }
});
