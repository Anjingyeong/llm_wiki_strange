import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isExcludedFromPublicIndex } from './indexable-content.mjs';
import { parseWikiSourceDocument } from './wiki-source-document.mjs';
import {
  auditWikiRelations,
  buildWikiRelationshipGraph,
} from '../../src/lib/wikiRelationships.mjs';

export { buildWikiRelationshipGraph };

const DOCUMENT_TYPES = new Set([
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
const DOCUMENT_STATUSES = new Set(['archived', 'partial', 'planned', 'superseded', 'verified']);
const EVIDENCE_LEVELS = new Set([
  'code-only',
  'unit-test',
  'offline-benchmark',
  'live-canary',
  'production',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function enumViolation(slug, field, value, allowed) {
  if (typeof value === 'string' && allowed.has(value)) {
    return null;
  }
  return {
    slug,
    field,
    message: `${slug}.${field}: ${JSON.stringify(value)} is outside the normalized contract`,
  };
}

export function auditWikiFrontmatterRecord(slug, data, context) {
  const violations = [
    enumViolation(slug, 'type', data.type, DOCUMENT_TYPES),
    enumViolation(slug, 'status', data.status, DOCUMENT_STATUSES),
    enumViolation(slug, 'evidenceLevel', data.evidenceLevel, EVIDENCE_LEVELS),
  ].filter(Boolean);

  if (data.status === 'verified' && (typeof data.verifiedAt !== 'string' || !ISO_DATE.test(data.verifiedAt))) {
    violations.push({
      slug,
      field: 'verifiedAt',
      message: `${slug}.verifiedAt: verified documents require an ISO date`,
    });
  }
  if (data.canonicalFor !== undefined && data.canonicalFor !== null
    && (typeof data.canonicalFor !== 'string' || !KEBAB_CASE.test(data.canonicalFor))) {
    violations.push({
      slug,
      field: 'canonicalFor',
      message: `${slug}.canonicalFor: ${JSON.stringify(data.canonicalFor)} must be null or kebab-case`,
    });
  }
  if (data.status === 'superseded' && typeof data.supersededBy !== 'string') {
    violations.push({
      slug,
      field: 'supersededBy',
      message: `${slug}.supersededBy: superseded documents require a replacement slug`,
    });
  }

  violations.push(...auditWikiRelations(slug, data.relations, context).map((message) => ({
    slug,
    field: 'relations',
    message,
  })));

  return violations;
}

export async function auditWikiContent(contentDir) {
  const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();
  const violations = [];
  const records = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const raw = await readFile(join(contentDir, file), 'utf8');
    let parsed;
    try {
      parsed = parseWikiSourceDocument(raw, file);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      violations.push({ slug, field: 'frontmatter', message: `${slug}.frontmatter: ${error.message}` });
      continue;
    }
    records.push({ slug, data: parsed.data, isPublic: !isExcludedFromPublicIndex(parsed.data) });
  }

  const allSlugs = new Set(records.map((record) => record.slug));
  const publicRecords = records.filter((record) => record.isPublic);
  const publicSlugs = new Set(publicRecords.map((record) => record.slug));
  const context = { allSlugs, publicSlugs };
  for (const record of publicRecords) {
    violations.push(...auditWikiFrontmatterRecord(record.slug, record.data, context));
  }

  return { fileCount: files.length, publicDocumentCount: publicRecords.length, violations };
}
