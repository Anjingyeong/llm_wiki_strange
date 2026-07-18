import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseWikiFrontmatterFields,
  parseWikiFrontmatterList,
  splitWikiFrontmatter,
} from '../src/lib/wikiFrontmatterCore.mjs';
import { listIndexableContentSlugs } from '../scripts/lib/indexable-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function readFields(slug) {
  const raw = await readFile(join(contentDir, `${slug}.md`), 'utf8');
  const parsed = splitWikiFrontmatter(raw);
  assert.ok(parsed, `${slug} must have parseable frontmatter`);
  return parseWikiFrontmatterFields(parsed.frontmatter);
}

function listField(fields, key) {
  const value = fields.get(key);
  return typeof value === 'string' ? parseWikiFrontmatterList(value) : [];
}

test('canonical, supersession, and redirect targets form a public reciprocal contract', async () => {
  // Given: root markdown files and the smaller public/indexable set.
  const rootSlugs = new Set(
    (await readdir(contentDir))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, '')),
  );
  const { slugs } = await listIndexableContentSlugs(contentDir);
  const publicSlugs = new Set(slugs);
  const violations = [];

  // When: canonical keys and document-to-document lifecycle edges are resolved.
  for (const slug of rootSlugs) {
    const fields = await readFields(slug);
    const canonicalFor = fields.get('canonicalFor');
    if (canonicalFor !== undefined && canonicalFor !== null
      && (canonicalFor === 'null' || typeof canonicalFor !== 'string' || !kebabCase.test(canonicalFor))) {
      violations.push(`${slug}.canonicalFor: ${JSON.stringify(canonicalFor)} must be null or kebab-case`);
    }

    for (const redirectTarget of listField(fields, 'redirectTo')) {
      if (!publicSlugs.has(redirectTarget)) {
        violations.push(`${slug}.redirectTo: ${redirectTarget} is not an existing public document`);
      }
    }

    if (fields.get('status') !== 'superseded') {
      continue;
    }
    const replacement = fields.get('supersededBy');
    if (typeof replacement !== 'string' || !publicSlugs.has(replacement)) {
      violations.push(`${slug}.supersededBy: ${JSON.stringify(replacement)} is not an existing public replacement`);
      continue;
    }
    const replacementFields = await readFields(replacement);
    if (!listField(replacementFields, 'supersedes').includes(slug)) {
      violations.push(`${slug}.supersededBy: ${replacement} does not reciprocate via supersedes`);
    }
  }

  // Then: no lifecycle edge escapes the public corpus or loses reciprocity.
  assert.deepEqual(violations, [], `canonical contract violations (${violations.length}):\n${violations.join('\n')}`);
});

test('internal documents remain outside the root public corpus', async () => {
  // Given/When: the public corpus is enumerated using the production index policy.
  const { slugs, documentCount } = await listIndexableContentSlugs(contentDir);

  // Then: only the 48 public root documents are visible; nested operations notes stay excluded.
  assert.equal(documentCount, 48);
  assert.equal(slugs.includes('Wiki-Ops-Sync'), false);
});
