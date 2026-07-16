import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLocationHash, wikiLink } from '../src/lib/wikiHash.ts';
import { allocateHeadingIds } from '../src/lib/wikiHeadings.mjs';
import { scrollTopForTocAnchor, selectTocHeadingId } from '../src/lib/tocSelection.mjs';

test('parseLocationHash: doc slug only', () => {
  const p = parseLocationHash('#/Frame-Sync-Canonical');
  assert.equal(p.view, 'doc');
  assert.equal(p.slug, 'Frame-Sync-Canonical');
  assert.equal(p.sectionId, null);
});

test('parseLocationHash: doc slug and section', () => {
  const p = parseLocationHash('#/AI-Pipeline/star-result');
  assert.equal(p.view, 'doc');
  assert.equal(p.slug, 'AI-Pipeline');
  assert.equal(p.sectionId, 'star-result');
});

test('parseLocationHash: search and rag views', () => {
  assert.deepEqual(parseLocationHash('#/__search__'), { view: 'search', slug: '', sectionId: null });
  assert.deepEqual(parseLocationHash('#/__rag__'), { view: 'rag', slug: '', sectionId: null });
});

test('wikiLink matches SPA hash convention', () => {
  assert.equal(wikiLink('Develop-Code-Baseline-2026-07-15'), '#/Develop-Code-Baseline-2026-07-15');
  assert.equal(wikiLink('AI-Pipeline', '벤치마크'), '#/AI-Pipeline/%EB%B2%A4%EC%B9%98%EB%A7%88%ED%81%AC');
});
test('allocateHeadingIds gives duplicate headings occurrence-aware, collision-safe IDs', () => {
  const headings = allocateHeadingIds([
    { text: 'Overview', level: 2 },
    { text: 'Overview-2', level: 2 },
    { text: 'Overview', level: 3 },
    { text: 'Overview', level: 2 },
  ]);

  assert.deepEqual(
    headings.map((heading) => heading.id),
    ['overview', 'overview-2', 'overview-3', 'overview-4'],
  );
});

test('TOC selection uses the last heading above the fixed top anchor', () => {
  assert.equal(
    selectTocHeadingId([
      { id: 'first', top: -20 },
      { id: 'second', top: 96 },
      { id: 'third', top: 97 },
    ]),
    'second',
  );
  assert.equal(selectTocHeadingId([{ id: 'first', top: 120 }]), 'first');
  assert.equal(scrollTopForTocAnchor(120, 500), 524);
});