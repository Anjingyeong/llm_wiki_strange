import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildWikiRelationshipGraph } from '../src/lib/wikiRelationships.mjs';
import { shouldHandleWikiLinkClick } from '../src/lib/wikiLinkActivation.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const articleSource = readFileSync(join(root, 'src/components/DocumentArticle.tsx'), 'utf8');
const evidenceSource = readFileSync(
  join(root, 'src/components/DocumentEvidencePanel.tsx'),
  'utf8',
);
const labelsSource = readFileSync(join(root, 'src/lib/wikiEvidence.ts'), 'utf8');
const documentsSource = readFileSync(join(root, 'src/lib/documents.ts'), 'utf8');
const stylesSource = readFileSync(join(root, 'src/styles.css'), 'utf8');

function readConstObject(name) {
  const declaration = new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`, 'u')
    .exec(labelsSource);
  assert.ok(declaration, `missing ${name}`);
  return Object.fromEntries(
    [...declaration[1].matchAll(/(?:'([^']+)'|([a-z][a-z-]*)):\s*'([^']+)'/gu)]
      .map((match) => [match[1] ?? match[2], match[3]]),
  );
}

test('document answer and evidence labels are truthful and exact', () => {
  assert.match(labelsSource, /return document\.summary \?\? document\.excerpt;/u);
  assert.match(labelsSource, /verifiedAt \? `\$\{verifiedAt\} 검증` : '검증일 미기재'/u);
  assert.doesNotMatch(articleSource, /document\.excerpt/u);
  for (const label of ['핵심 답변', '문서 유형', '문서 상태', '근거 수준', '검증', '마지막 업데이트']) {
    assert.match(evidenceSource, new RegExp(label, 'u'));
  }
});

test('every document machine enum has a clear Korean label', () => {
  assert.deepEqual(readConstObject('WIKI_DOCUMENT_TYPE_LABELS'), {
    architecture: '아키텍처',
    baseline: '기준선',
    contract: '계약',
    'daily-log': '일일 기록',
    decision: '결정',
    evidence: '근거',
    experiment: '실험',
    incident: '장애 기록',
    meta: '메타',
    overview: '개요',
    plan: '계획',
    reference: '참고',
    runbook: '운영 절차',
  });
  assert.deepEqual(readConstObject('WIKI_DOCUMENT_STATUS_LABELS'), {
    archived: '보관됨',
    partial: '부분 검증',
    planned: '계획됨',
    superseded: '대체됨',
    verified: '검증됨',
  });
  assert.deepEqual(readConstObject('WIKI_EVIDENCE_LEVEL_LABELS'), {
    'code-only': '코드 확인',
    'unit-test': '단위 테스트',
    'offline-benchmark': '오프라인 벤치마크',
    'live-canary': '라이브 카나리',
    production: '운영 환경',
  });
});

test('typed relations expose directional labels and deep-link anchors', () => {
  assert.deepEqual(readConstObject('WIKI_OUTGOING_RELATION_LABELS'), {
    related: '관련됨',
    supports: '근거를 보탬',
    'depends-on': '선행 지식으로 참조',
    implements: '구현함',
    supersedes: '대체함',
    contrasts: '대조함',
  });
  assert.deepEqual(readConstObject('WIKI_BACKLINK_RELATION_LABELS'), {
    related: '이 문서와 관련됨',
    supports: '이 문서를 뒷받침함',
    'depends-on': '이 문서에 의존함',
    implements: '이 문서를 구현함',
    supersedes: '이 문서를 대체함',
    contrasts: '이 문서와 대조함',
  });
  assert.match(evidenceSource, /href=\{wikiLink\(document\.slug\)\}/u);
  assert.match(evidenceSource, /event\.preventDefault\(\);\s*onSelectDocument\(document\.slug\)/u);
  assert.match(evidenceSource, /document\.status === 'superseded'/u);
  assert.match(evidenceSource, /href=\{wikiLink\(replacement\.slug\)\}/u);
});

test('SPA navigation intercepts only an unmodified primary link click', () => {
  const primaryClick = {
    button: 0,
    defaultPrevented: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  assert.equal(shouldHandleWikiLinkClick(primaryClick), true);

  for (const override of [
    { button: 1 },
    { button: 2 },
    { defaultPrevented: true },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
  ]) {
    assert.equal(shouldHandleWikiLinkClick({ ...primaryClick, ...override }), false);
  }
  assert.equal(
    [...evidenceSource.matchAll(/if \(!shouldHandleWikiLinkClick\(event\)\) return;/gu)].length,
    2,
  );
});

test('browser graph is derived from all parsed documents and resolves exact backlinks', () => {
  const graph = buildWikiRelationshipGraph([
    { slug: 'Overview', relations: ['supports:Architecture', 'related:Evidence'] },
    { slug: 'Architecture', relations: ['depends-on:Evidence'] },
    { slug: 'Evidence', relations: [] },
  ]);
  assert.deepEqual(graph.get('Evidence').backlinks, [
    { kind: 'related', sourceSlug: 'Overview' },
    { kind: 'depends-on', sourceSlug: 'Architecture' },
  ]);
  assert.match(documentsSource, /buildWikiRelationshipGraph\(documents\)/u);
  assert.match(evidenceSource, /documentsBySlug\.get\(relation\.targetSlug\)/u);
  assert.match(evidenceSource, /documentsBySlug\.get\(backlink\.sourceSlug\)/u);
});

test('evidence and relation layout stays bounded and wraps responsively', () => {
  assert.match(stylesSource, /\.documentEvidence[\s\S]*?border-bottom: 1px solid var\(--line\)/u);
  assert.match(stylesSource, /\.documentFacts[\s\S]*?repeat\(auto-fit, minmax\(128px, 1fr\)\)/u);
  assert.match(stylesSource, /@media \(max-width: 720px\)[\s\S]*?\.documentRelationships[\s\S]*?grid-template-columns: 1fr/u);
});
