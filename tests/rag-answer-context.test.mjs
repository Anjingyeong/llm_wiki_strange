import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  expandQuery,
  hasSufficientContext,
} from '../scripts/lib/rag/answer.mjs';
import { buildLocalTemplateAnswer } from '../scripts/lib/rag/templates.mjs';

describe('expandQuery topic scope', () => {
  it('does not dump full stack for bare 흐름 questions without topic', () => {
    const out = expandQuery('전체 시스템 구조와 흐름이 궁금합니다');
    // May expand YOLO path only if pipeline keywords fire; should not always add TensorRT
    assert.ok(!out.includes('TensorRT') || out.includes('pipeline') || out.includes('파이프라인'));
  });

  it('expands TensorRT topic aliases', () => {
    const out = expandQuery('TensorRT 적용 흐름');
    assert.match(out, /engine|backend|benchmark/i);
    assert.ok(!out.includes('WebRTC HLS'));
  });

  it('expands MQTT topic aliases', () => {
    const out = expandQuery('MQTT 이벤트 흐름');
    assert.match(out, /subscriber|payload|topic/i);
  });

  it('expands overlay sync aliases', () => {
    const out = expandQuery('Overlay 동기화 흐름');
    assert.match(out, /frameId|buffer|STOMP/i);
  });
});

describe('hasSufficientContext hybrid', () => {
  it('accepts strong vector with original-query grounding', () => {
    const chunks = [
      {
        score: 0.12,
        vectorScore: 0.6,
        matchedBy: ['vector'],
        slug: 'ED-Latest-Frame-Queue-Policy',
        title: 'Latest Frame Queue Policy',
        text: '오래된 RTSP 프레임을 drop 하고 latest frame 만 유지한다.',
      },
    ];
    assert.equal(
      hasSufficientContext(chunks, 'hybrid', {
        originalQuestion: '왜 오래된 RTSP 프레임을 버리나요?',
        expandedQuery: '왜 오래된 RTSP 프레임을 버리나요?',
      }),
      true,
    );
  });

  it('accepts lexical match with modest score and content tokens', () => {
    const chunks = [
      {
        score: 0.05,
        vectorScore: 0.1,
        matchedBy: ['bm25'],
        slug: 'ED-MQTT-Backend-Event-Path',
        title: 'MQTT path',
        text: 'MQTT 이벤트가 DB 와 프론트까지 전달된다.',
      },
    ];
    assert.equal(
      hasSufficientContext(chunks, 'hybrid', {
        originalQuestion: 'MQTT 이벤트가 DB와 프론트까지 어떻게 전달되나요?',
        expandedQuery: 'MQTT 이벤트가 DB와 프론트까지 어떻게 전달되나요?',
      }),
      true,
    );
  });

  it('rejects empty', () => {
    assert.equal(hasSufficientContext([], 'hybrid'), false);
  });

  it('rejects weak scores', () => {
    const chunks = [{ score: 0.005, vectorScore: 0.1, matchedBy: [], text: 'x', title: 'x' }];
    assert.equal(
      hasSufficientContext(chunks, 'hybrid', {
        originalQuestion: ' unrelated nonsense query ',
        expandedQuery: ' unrelated nonsense query ',
      }),
      false,
    );
  });

  it('rejects strong vector with zero original token coverage', () => {
    const chunks = [
      {
        score: 0.15,
        vectorScore: 0.7,
        matchedBy: ['vector'],
        slug: 'Random',
        title: 'Random Doc',
        text: 'overlay frame queue rtsp latency',
      },
    ];
    assert.equal(
      hasSufficientContext(chunks, 'hybrid', {
        originalQuestion: '직원 급여 정책',
        expandedQuery: '직원 급여 정책',
      }),
      false,
    );
  });
});

describe('local fallback answer readability', () => {
  it('uses wiki links and omits raw Mermaid and local file URLs', () => {
    // Given: retrieved text contains implementation details that are useful for indexing but noisy to read.
    const chunks = [{
      displayTitle: '프레임 동기화',
      slug: 'Frame-Sync-Canonical',
      text: '검증 근거 ## graph TD\nsubgraph AI[AI Engine]\nA -->|frameId| B\nend\n중요한 결론은 반드시 유지되어야 합니다. file:///c:/private/source.md',
      title: 'Frame Sync Canonical',
    }];

    // When: the local evidence answer is composed.
    const answer = buildLocalTemplateAnswer(chunks, 'evidence_template');

    // Then: the reader gets a wiki-native reference without raw diagram syntax or machine-local paths.
    assert.match(answer, /\[프레임 동기화\]\(\.\/Frame-Sync-Canonical\.md\)/u);
    assert.doesNotMatch(answer, /\bgraph\s+TD\b/iu);
    assert.doesNotMatch(answer, /\bsubgraph\b|--?>/iu);
    assert.doesNotMatch(answer, /file:\/\//iu);
    assert.match(answer, /중요한 결론은 반드시 유지되어야 합니다/u);
  });

  it('prefers explanatory Korean sentences over code-heavy retrieval fragments', () => {
    const chunks = [{
      slug: 'Frame-Sync-Canonical',
      text: 'OverlaySyncBuffer.push :: frameId_eventId -> SessionIdentity. 프레임 식별자를 기준으로 동기화를 검증합니다.',
      title: 'Frame Sync Canonical',
    }];

    const answer = buildLocalTemplateAnswer(chunks, 'general');

    assert.match(answer, /프레임 식별자를 기준으로 동기화를 검증합니다/u);
    assert.doesNotMatch(answer, /OverlaySyncBuffer\.push/u);
    assert.match(answer, /### 검증 포인트/u);
  });
});
