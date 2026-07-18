import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  auditWikiContent,
  auditWikiFrontmatterRecord,
} from '../scripts/lib/wiki-frontmatter-audit.mjs';

test('Given malformed public metadata When auditing Then every violation identifies its slug and field', () => {
  // Given: a public record with independent enum and verified-state violations.
  const record = {
    type: 'engineering-decision',
    status: 'verified',
    evidenceLevel: 'manual-check',
    verifiedAt: 'yesterday',
  };

  // When: the machine contract audits the parsed boundary value.
  const violations = auditWikiFrontmatterRecord('Bad-Decision', record);

  // Then: one pass reports every actionable slug/field diagnostic.
  assert.deepEqual(
    violations.map((violation) => violation.field),
    ['type', 'evidenceLevel', 'verifiedAt'],
  );
  assert.ok(violations.every((violation) => violation.slug === 'Bad-Decision'));
  assert.ok(violations.every((violation) => violation.message.length > 0));
});

test('Given normalized public metadata When auditing Then the record has no violations', () => {
  // Given: a valid public evidence record.
  const record = {
    type: 'evidence',
    status: 'partial',
    evidenceLevel: 'offline-benchmark',
  };

  // When: the same boundary audit runs.
  const violations = auditWikiFrontmatterRecord('Evidence-Report', record);

  // Then: the normalized record is accepted.
  assert.deepEqual(violations, []);
});

test('Given sorted files When auditing concurrently Then diagnostics keep their established order', async (t) => {
  const contentDir = await mkdtemp(join(tmpdir(), 'wiki-frontmatter-audit-'));
  t.after(() => rm(contentDir, { recursive: true, force: true }));
  await Promise.all([
    writeFile(join(contentDir, 'A-invalid-contract.md'), [
      '---',
      'title: Invalid contract',
      'type: unknown',
      'status: unknown',
      'evidenceLevel: unknown',
      '---',
      '# Invalid contract',
    ].join('\n')),
    writeFile(join(contentDir, 'B-missing-frontmatter.md'), '# Missing frontmatter'),
  ]);

  const result = await auditWikiContent(contentDir);

  assert.equal(result.fileCount, 2);
  assert.equal(result.publicDocumentCount, 1);
  assert.deepEqual(
    result.violations.map(({ slug, field }) => `${slug}.${field}`),
    [
      'B-missing-frontmatter.frontmatter',
      'A-invalid-contract.type',
      'A-invalid-contract.status',
      'A-invalid-contract.evidenceLevel',
    ],
  );
});
