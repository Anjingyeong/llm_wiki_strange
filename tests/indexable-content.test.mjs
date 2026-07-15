import assert from 'node:assert/strict';
import test from 'node:test';
import { isExcludedFromPublicIndex } from '../scripts/lib/indexable-content.mjs';

test('isExcludedFromPublicIndex matches search index rules', () => {
  assert.equal(isExcludedFromPublicIndex({ status: 'archived' }), true);
  assert.equal(isExcludedFromPublicIndex({ wikiVisibility: 'internal' }), true);
  assert.equal(isExcludedFromPublicIndex({ status: 'partial' }), false);
  assert.equal(isExcludedFromPublicIndex({}), false);
});