import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  expandQuery,
  hasSufficientContext,
  answerQuestionFromIndex,
  computeContextSignals,
  evaluateRetrievalRelevance,
  evaluateAnswerSupport,
  detectNumericOrStatusIntent,
} from '../scripts/lib/rag/answer.mjs';
import {
  extractExactSymbols,
  tokenCoverage,
  contentTokens,
} from '../scripts/lib/rag/abstention.mjs';
import { searchDocumentsInIndex, NO_RESULT_THRESHOLD } from '../src/lib/searchCore.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('abstention signals (unit)', () => {
  it('extracts exact symbols like frameId and TensorRT', () => {
    const symbols = extractExactSymbols('frameId와 TensorRT, safety/events 확인');
    assert.ok(symbols.some((s) => /frameId/i.test(s)));
    assert.ok(symbols.some((s) => /TensorRT/i.test(s)));
    assert.ok(symbols.some((s) => /safety\/events/i.test(s)));
  });

  it('detects numeric/status intent phrases', () => {
    assert.equal(detectNumericOrStatusIntent('사고율이 몇 퍼센트 감소했나요?'), true);
    assert.equal(detectNumericOrStatusIntent('지연이 항상 1초 이내였나요?'), true);
    assert.equal(detectNumericOrStatusIntent('실제 적용됐나요?'), true);
    assert.equal(detectNumericOrStatusIntent('frameId는 왜 필요한가요?'), false);
  });

  it('strong vector but original content coverage 0 → reject', () => {
    const chunks = [
      {
        score: 0.15,
        vectorScore: 0.62,
        matchedBy: ['vector'],
        slug: 'Unrelated-Doc',
        title: 'Unrelated',
        text: 'blockchain kubernetes kubernetes kubernetes payroll hr benefits',
      },
    ];
    const question = '직원 급여 정책 상세';
    // content tokens won't match blockchain text if we pick terms carefully
    const signals = computeContextSignals(chunks, question, question);
    // Force zero original content coverage for the policy under test
    signals.originalContentCoverage = 0;
    signals.originalAllCoverage = 0;
    signals.originalContentMatched = [];
    signals.symbolMatch = false;
    signals.expansionOnlyMatch = false;
    signals.hasLexicalMatch = false;
    signals.titleSectionCoverage = 0;
    const result = evaluateRetrievalRelevance(chunks, 'hybrid', {
      originalQuestion: question,
      expandedQuery: question,
      signals,
    });
    assert.equal(result.relevant, false);
    assert.match(result.reason, /strong_vector_zero_original|insufficient|ungrounded|generic/i);
  });

  it('expansion alias only match → reject', () => {
    const original = '완전무관한질문xyz';
    const expanded = `${original} TensorRT engine backend MQTT`;
    const chunks = [
      {
        score: 0.1,
        vectorScore: 0.5,
        matchedBy: ['vector', 'bm25'],
        slug: 'Evidence-TensorRT-Adoption-Decision',
        title: 'TensorRT Adoption',
        text: 'TensorRT engine backend benchmark MQTT overlay',
      },
    ];
    const signals = computeContextSignals(chunks, original, expanded);
    assert.equal(signals.expansionOnlyMatch, true);
    const result = evaluateRetrievalRelevance(chunks, 'hybrid', {
      originalQuestion: original,
      expandedQuery: expanded,
      signals,
    });
    assert.equal(result.relevant, false);
    assert.equal(result.reason, 'expansion_only_no_original');
  });

  it('strong semantic paraphrase + sufficient margin → accept', () => {
    const chunks = [
      {
        score: 0.2,
        vectorScore: 0.55,
        matchedBy: ['vector'],
        slug: 'ED-Latest-Frame-Queue-Policy',
        title: 'Latest Frame Queue',
        sectionTitle: 'drop stale frames',
        text: '오래된 프레임을 버리고 최신 RTSP 프레임만 유지합니다.',
      },
      {
        score: 0.05,
        vectorScore: 0.2,
        matchedBy: ['vector'],
        slug: 'Other',
        title: 'Other',
        text: 'other',
      },
    ];
    const q = '왜 오래된 RTSP 프레임을 버리나요?';
    const result = evaluateRetrievalRelevance(chunks, 'hybrid', {
      originalQuestion: q,
      expandedQuery: expandQuery(q),
    });
    assert.equal(result.relevant, true);
  });

  it('exact symbol match → accept', () => {
    const chunks = [
      {
        score: 0.04,
        vectorScore: 0.2,
        matchedBy: ['bm25', 'vector'],
        slug: 'ED-FrameId-Evidence-Overlay-Sync',
        title: 'frameId overlay sync',
        text: 'frameId is required for overlay synchronization with capturedAtMs',
      },
    ];
    const q = 'frameId는 왜 필요한가요?';
    const result = evaluateRetrievalRelevance(chunks, 'hybrid', {
      originalQuestion: q,
      expandedQuery: expandQuery(q),
    });
    assert.equal(result.relevant, true);
    assert.equal(result.reason, 'exact_symbol');
  });

  it('lexical + modest score with content tokens → accept', () => {
    const chunks = [
      {
        score: 0.05,
        vectorScore: 0.15,
        matchedBy: ['bm25'],
        slug: 'ED-MQTT-Backend-Event-Path',
        title: 'MQTT Event Path',
        text: 'MQTT 이벤트가 DB와 프론트까지 전달되는 경로를 설명합니다. safety/events subscriber',
      },
    ];
    const q = 'MQTT 이벤트가 DB와 프론트까지 어떻게 전달되나요?';
    const result = evaluateRetrievalRelevance(chunks, 'hybrid', {
      originalQuestion: q,
      expandedQuery: expandQuery(q),
    });
    assert.equal(result.relevant, true);
  });

  it('related docs but no requested numeric evidence → unsupported', () => {
    const chunks = [
      {
        score: 0.2,
        vectorScore: 0.5,
        matchedBy: ['bm25', 'vector'],
        slug: 'Evidence-TensorRT-Adoption-Decision',
        title: 'TensorRT Adoption',
        text: 'TensorRT 도입을 검토했다. 백엔드 선택 구조를 설계했다. 수치 측정은 없다.',
      },
    ];
    const q = 'TensorRT 적용 후 전력 사용량이 몇 와트 감소했나요?';
    assert.equal(detectNumericOrStatusIntent(q), true);
    const support = evaluateAnswerSupport(q, chunks);
    assert.equal(support.supported, false);
    assert.equal(support.intent, true);
  });

  it('denial text + stray number does not support numeric metric claims', () => {
    const chunks = [
      {
        score: 0.2,
        vectorScore: 0.5,
        matchedBy: ['bm25', 'vector'],
        slug: 'ED-Fall-Faint-Lifecycle',
        title: 'Fall lifecycle',
        // Family keyword + denial + unrelated 95% elsewhere must NOT support.
        text: '낙상 탐지 파이프라인을 운영한다. 사고율 데이터는 없음. 다른 실험 recall은 95%였다.',
      },
    ];
    const q = '낙상 탐지로 실제 사고율이 몇 퍼센트 감소했나요?';
    const support = evaluateAnswerSupport(q, chunks);
    assert.equal(support.supported, false);
    assert.match(String(support.reason), /denied|missing|no_number|metric/i);
  });

  it('always_claim with bare 보장 only → unsupported', () => {
    const chunks = [
      {
        score: 0.2,
        vectorScore: 0.5,
        matchedBy: ['vector'],
        slug: 'ADR-004-LSTM-Feature-Expansion',
        title: 'LSTM feature',
        text: 'feature 확장이 항상 성능 개선을 보장하지는 않는다. YOLO 추론 경로는 별도다.',
      },
    ];
    // "보장하지는 않는다" / bare 보장 must not satisfy "항상 30ms 이내"
    const q = 'YOLO 추론이 항상 30ms 이내였나요?';
    const support = evaluateAnswerSupport(q, chunks);
    assert.equal(support.supported, false);
  });

  it('always + bound supported only when co-located measurement exists', () => {
    const chunks = [
      {
        score: 0.2,
        vectorScore: 0.5,
        matchedBy: ['bm25', 'vector'],
        slug: 'Benchmark-History',
        title: 'Benchmark',
        text: '측정 결과 YOLO 추론 latency는 항상 28ms 이내였다. p95=28ms.',
      },
    ];
    const q = 'YOLO 추론이 항상 30ms 이내였나요?';
    const support = evaluateAnswerSupport(q, chunks);
    // Bound asked is 30ms; corpus has 28ms — still needs 30ms or we reject bound mismatch.
    // Either unsupported (bound missing) or supported only if we relax — require unsupported for 30 vs 28.
    assert.equal(support.supported, false);
  });

  it('hasSufficientContext remains callable with (chunks, mode)', () => {
    assert.equal(hasSufficientContext([], 'hybrid'), false);
    assert.equal(
      hasSufficientContext(
        [{ score: 0.2, vectorScore: 0.6, matchedBy: ['vector'], title: 'frameId', text: 'frameId sync', slug: 'x' }],
        'hybrid',
        { originalQuestion: 'frameId 필요성', expandedQuery: 'frameId 필요성' },
      ),
      true,
    );
  });
});

describe('abstention integration with live index', () => {
  let index;
  let golden;

  it('loads index fixtures', async () => {
    index = JSON.parse(await readFile(join(root, 'data/ragVectorIndex.json'), 'utf8'));
    golden = JSON.parse(await readFile(join(root, 'data/client-search/golden-queries.json'), 'utf8'));
    assert.ok(Array.isArray(index.chunks) || Array.isArray(index));
  });

  it('fully unrelated question → sources empty + insufficient_context', async () => {
    const answer = await answerQuestionFromIndex(index, '직원 급여 정책', { mode: 'hybrid' });
    assert.equal(answer.status, 'insufficient_context');
    assert.equal(answer.sources.length, 0);
    assert.equal(answer.retrievalRelevant, false);
    assert.equal(answer.answerSupported, false);
  });

  it('near-domain unsupported numeric → insufficient_context, no false answer', async () => {
    const answer = await answerQuestionFromIndex(
      index,
      '얼굴인식 정확도는 몇 퍼센트인가요?',
      { mode: 'hybrid' },
    );
    assert.equal(answer.status, 'insufficient_context');
    assert.equal(answer.answerSupported, false);
    assert.ok(!/^\s*\d+(\.\d+)?\s*%/.test(answer.answer || ''));
  });

  it('camera hardcoding paraphrases hit Multi-Camera or Runtime Stabilization in Top3', async () => {
    const { searchRelevantChunks } = await import('../scripts/lib/rag/search.mjs');
    const expected = [
      'Multi-Camera-Worker-Session-Reliability',
      'Realtime-Camera-Runtime-Stabilization',
    ];
    const queries = [
      '카메라는 하드코딩되어 있나요?',
      '카메라 목록이 코드에 고정되어 있나요?',
      '카메라는 동적으로 추가되나요?',
    ];
    for (const q of queries) {
      const answer = await answerQuestionFromIndex(index, q, { mode: 'hybrid' });
      const chunks = searchRelevantChunks(index, expandQuery(q), { mode: 'hybrid', limit: 6 });
      const top3 = chunks.map((c) => c.slug || c.documentId).slice(0, 3);
      assert.ok(
        expected.some((e) => top3.includes(e)),
        `expected one of ${expected.join(',')} in top3 for "${q}", got ${top3.join(',')}`,
      );
      assert.equal(answer.status, 'answered', q);
      assert.equal(answer.retrievalRelevant, true, q);
      assert.equal(answer.answerSupported, true, q);
    }
  });

  it('camera unanswerable cost/count stays insufficient_context', async () => {
    for (const q of [
      '100대 카메라 운영 비용은 얼마인가요?',
      '카메라 구매 가격은 얼마인가요?',
      '지원 가능한 카메라는 정확히 최대 몇 대인가요?',
    ]) {
      const answer = await answerQuestionFromIndex(index, q, { mode: 'hybrid' });
      assert.equal(answer.status, 'insufficient_context', q);
      assert.equal(answer.answerSupported, false, q);
    }
  });

  it('related 10 hybrid regression: Top3 expected ≥ 9/10', async () => {
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
    let hits = 0;
    const misses = [];
    for (const item of related) {
      const answer = await answerQuestionFromIndex(index, item.q, { mode: 'hybrid' });
      const slugs = (answer.sources || []).map((s) => s.slug);
      // Also allow retrieval via search when answered unsupported? use sources only for answered
      const { searchRelevantChunks } = await import('../scripts/lib/rag/search.mjs');
      const chunks = searchRelevantChunks(index, expandQuery(item.q), { mode: 'hybrid', limit: 6 });
      const top3 = chunks.map((c) => c.slug || c.documentId).slice(0, 3);
      const hit = item.expected.some((e) => top3.includes(e) || slugs.includes(e));
      if (hit) hits += 1;
      else misses.push({ q: item.q, top3, status: answer.status });
    }
    assert.ok(hits >= 9, `related hybrid Top3 ${hits}/10 misses=${JSON.stringify(misses)}`);
  });

  it('Front Golden 23 regression', async () => {
    const bundle = JSON.parse(await readFile(join(root, 'src/generated/searchIndex.json'), 'utf8'));
    const searchIndex = Array.isArray(bundle) ? bundle : (bundle.documents ?? []);
    const cases = golden.queries || [];
    assert.ok(Array.isArray(cases));
    assert.ok(cases.length >= 23);
    let pass = 0;
    let evaluated = 0;
    for (const c of cases) {
      if (c.expectEmpty || c.expectEmptyOrWeak) {
        const results = searchDocumentsInIndex(searchIndex, c.query, {
          limit: 3,
          minScore: NO_RESULT_THRESHOLD,
        });
        evaluated += 1;
        if (results.length === 0) pass += 1;
        continue;
      }
      if (!c.expectedSlugs?.length) continue;
      evaluated += 1;
      const topK = c.topK ?? golden.defaultTopK ?? 3;
      const results = searchDocumentsInIndex(searchIndex, c.query, {
        limit: Math.max(topK, 10),
        minScore: NO_RESULT_THRESHOLD,
      });
      const top = results.slice(0, topK).map((r) => r.slug);
      if (c.expectedSlugs.some((e) => top.includes(e))) pass += 1;
    }
    assert.ok(evaluated >= 23, `expected ≥23 golden cases, got ${evaluated}`);
    assert.equal(pass, evaluated, `Front Golden ${pass}/${evaluated}`);
  });
});
