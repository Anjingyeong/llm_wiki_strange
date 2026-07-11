import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  expandQuery,
  hasSufficientContext,
} from '../scripts/lib/rag/answer.mjs';

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
  it('accepts strong vector without lexical match', () => {
    const chunks = [
      {
        score: 0.12,
        vectorScore: 0.6,
        matchedBy: ['vector'],
      },
    ];
    assert.equal(hasSufficientContext(chunks, 'hybrid'), true);
  });

  it('accepts lexical match with modest score', () => {
    const chunks = [
      {
        score: 0.05,
        vectorScore: 0.1,
        matchedBy: ['bm25'],
      },
    ];
    assert.equal(hasSufficientContext(chunks, 'hybrid'), true);
  });

  it('rejects empty', () => {
    assert.equal(hasSufficientContext([], 'hybrid'), false);
  });

  it('rejects weak scores', () => {
    const chunks = [{ score: 0.005, vectorScore: 0.1, matchedBy: [] }];
    assert.equal(hasSufficientContext(chunks, 'hybrid'), false);
  });
});
