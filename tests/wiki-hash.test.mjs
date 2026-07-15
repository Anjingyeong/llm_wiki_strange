import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLocationHash, wikiLink } from '../src/lib/wikiHash.ts';

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