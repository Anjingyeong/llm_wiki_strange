import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseWikiFrontmatterFields,
  splitWikiFrontmatter,
} from '../src/lib/wikiFrontmatterCore.mjs';
import { listIndexableContentSlugs } from '../scripts/lib/indexable-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');

const allowedTypes = new Set([
  'architecture',
  'baseline',
  'contract',
  'daily-log',
  'decision',
  'evidence',
  'experiment',
  'incident',
  'meta',
  'overview',
  'plan',
  'reference',
  'runbook',
]);
const allowedStatuses = new Set(['archived', 'partial', 'planned', 'superseded', 'verified']);
const allowedEvidenceLevels = new Set([
  'code-only',
  'unit-test',
  'offline-benchmark',
  'live-canary',
  'production',
]);
const isoDate = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/;

function requireEnum(violations, slug, fields, field, allowed) {
  const value = fields.get(field);
  if (typeof value !== 'string' || !allowed.has(value)) {
    violations.push(`${slug}.${field}: ${JSON.stringify(value)} is not one of ${[...allowed].join(', ')}`);
  }
}

test('every public root document exposes normalized machine-readable metadata', async () => {
  // Given: exactly the documents consumed by public search and operational RAG.
  const { slugs } = await listIndexableContentSlugs(contentDir);
  const violations = [];

  // When: their frontmatter crosses the shared parser boundary.
  for (const slug of slugs) {
    const raw = await readFile(join(contentDir, `${slug}.md`), 'utf8');
    const parsed = splitWikiFrontmatter(raw);
    assert.ok(parsed, `${slug} must have parseable frontmatter`);
    const fields = parseWikiFrontmatterFields(parsed.frontmatter);

    requireEnum(violations, slug, fields, 'type', allowedTypes);
    requireEnum(violations, slug, fields, 'status', allowedStatuses);
    requireEnum(violations, slug, fields, 'evidenceLevel', allowedEvidenceLevels);

    if (fields.get('status') === 'verified') {
      const verifiedAt = fields.get('verifiedAt');
      if (typeof verifiedAt !== 'string' || !isoDate.test(verifiedAt)) {
        violations.push(`${slug}.verifiedAt: verified documents require an ISO date`);
      }
    }
  }

  // Then: a single diagnostic reports every slug/field migration gap.
  assert.deepEqual(violations, [], `machine metadata violations (${violations.length}):\n${violations.join('\n')}`);
});
