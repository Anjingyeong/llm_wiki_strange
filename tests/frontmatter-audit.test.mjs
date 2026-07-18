import assert from 'node:assert/strict';
import test from 'node:test';

import { auditWikiFrontmatterRecord } from '../scripts/lib/wiki-frontmatter-audit.mjs';

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
