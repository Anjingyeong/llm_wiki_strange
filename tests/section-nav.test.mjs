import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractHeadingsFromBody, slugifyHeading } from '../scripts/lib/heading-utils.mjs';
import {
  NO_RESULT_THRESHOLD,
  pickSectionIdFromHeadings,
  searchDocumentsInIndex,
  tokenizeQuery,
} from '../src/lib/searchCore.mjs';

describe('heading utils parity', () => {
  it('slugify matches renderer-style ids', () => {
    assert.equal(slugifyHeading('문제 정의'), '문제-정의');
    assert.equal(slugifyHeading('내가 한 판단'), '내가-한-판단');
  });

  it('extracts H2/H3 with searchableText', () => {
    const body = '## 문제 정의\n\ntext\n\n### 세부\n\n## 데이터 흐름\n';
    const h = extractHeadingsFromBody(body);
    assert.equal(h.length, 3);
    assert.equal(h[0].id, '문제-정의');
    assert.equal(h[0].level, 2);
    assert.ok(h[0].searchableText.includes('문제'));
  });
});

describe('matchedSectionId from headings metadata', () => {
  it('returns non-null section id for heading-relevant query', () => {
    const doc = {
      slug: 'ED-Latest-Frame-Queue-Policy',
      title: '실시간성을 위해 오래된 RTSP 프레임을 버리기로 한 판단',
      navTitle: '실시간 프레임 지연 제어',
      shortTitle: 'Latest Frame',
      displayTitle: '실시간 프레임 지연 제어',
      category: 'Architecture',
      tags: ['frame-queue'],
      relatedFiles: ['ai/ai/frame_sync.py'],
      summary: 'latest frame',
      excerpt: 'latest',
      text: 'CameraFrameQueue put_latest get_latest RTSP latency',
      headings: extractHeadingsFromBody(`## 문제 정의

문단

## 내가 한 판단

판단

## 데이터 흐름

flow
`),
    };
    const q = tokenizeQuery('판단');
    const sectionId = pickSectionIdFromHeadings(doc, q);
    assert.equal(sectionId, '내가-한-판단');
    assert.notEqual(sectionId, null);

    const results = searchDocumentsInIndex([doc], '내가 한 판단', {
      limit: 3,
      minScore: NO_RESULT_THRESHOLD,
    });
    assert.ok(results.length >= 1);
    assert.ok(results[0].matchedSectionId, 'matchedSectionId must be non-null');
    assert.equal(results[0].matchedSectionId, '내가-한-판단');
  });
});
