import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveDisplayTitle,
  resolveNavigationTitle,
  resolvePageTitle,
  resolveReferenceTitle,
} from '../src/lib/wikiTitle.mjs';

const document = {
  slug: 'AI-Pipeline',
  title: 'AI Pipeline Architecture and Runtime Contract',
  navTitle: 'AI 파이프라인',
  shortTitle: 'AI 흐름',
};

test('page titles prefer the coherent reader-facing title over compact references', () => {
  assert.equal(resolvePageTitle(document), 'AI 파이프라인');
  assert.equal(resolveDisplayTitle(document), 'AI 파이프라인');
});

test('navigation and relationship labels use their dedicated compact priorities', () => {
  assert.equal(resolveNavigationTitle(document), 'AI 파이프라인');
  assert.equal(resolveReferenceTitle(document), 'AI 흐름');
});

test('title helpers fall back to canonical title and slug without throwing', () => {
  assert.equal(resolvePageTitle({ title: 'Canonical Title', slug: 'canonical' }), 'Canonical Title');
  assert.equal(resolveNavigationTitle({ slug: 'fallback-slug' }), 'fallback-slug');
  assert.equal(resolveReferenceTitle({}), '');
});
