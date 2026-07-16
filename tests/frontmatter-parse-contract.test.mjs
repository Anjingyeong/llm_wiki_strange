import assert from 'node:assert/strict';

import {
  extractWikiVisibility,
  normalizeWikiRaw,
  parseWikiFrontmatterFields,
  parseWikiFrontmatterList,
  splitWikiFrontmatter,
} from '../src/lib/wikiFrontmatterCore.mjs';

const valid = splitWikiFrontmatter('---\ntitle: Example\ntags: [one, "two"]\n---\n# Body');
assert.deepEqual(valid, {
  frontmatter: 'title: Example\ntags: [one, "two"]',
  body: '# Body',
});
assert.deepEqual(parseWikiFrontmatterList(parseWikiFrontmatterFields(valid.frontmatter).get('tags') ?? ''), ['one', 'two']);

assert.deepEqual(splitWikiFrontmatter('---\ntitle: Empty\n---'), {
  frontmatter: 'title: Empty',
  body: '',
});
assert.deepEqual(splitWikiFrontmatter('---\ntitle: Empty\n---\n'), {
  frontmatter: 'title: Empty',
  body: '',
});

const bomAndWhitespace = '\uFEFF \r\n\t---\r\ntitle: Normalized\r\n---\r\nBody';
assert.equal(normalizeWikiRaw(bomAndWhitespace), '---\r\ntitle: Normalized\r\n---\r\nBody');
assert.deepEqual(splitWikiFrontmatter(bomAndWhitespace), {
  frontmatter: 'title: Normalized',
  body: 'Body',
});

assert.equal(splitWikiFrontmatter('title: Missing opening delimiter\n---\nBody'), null);
assert.equal(splitWikiFrontmatter('---\ntitle: Missing closing delimiter\nBody'), null);
assert.equal(splitWikiFrontmatter('---\ntitle: Trailing text\n--- trailing'), null);

const fields = parseWikiFrontmatterFields('wikiVisibility: internal\nvisibility: public');
assert.equal(extractWikiVisibility(fields), 'internal');
assert.equal(extractWikiVisibility(parseWikiFrontmatterFields('visibility: public')), 'public');
assert.equal(extractWikiVisibility(parseWikiFrontmatterFields('title: Visible')), undefined);

console.log('frontmatter parse contract OK');
