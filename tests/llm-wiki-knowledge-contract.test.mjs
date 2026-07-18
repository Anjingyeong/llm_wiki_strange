import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as frontmatterAudit from '../scripts/lib/wiki-frontmatter-audit.mjs';
import * as markdownParse from '../src/lib/markdownParse.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function readTreeSource(relativeDirectory) {
  const directory = join(root, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return readTreeSource(relativePath);
      return /\.(?:ts|tsx|mjs)$/u.test(entry.name) ? [readSource(relativePath)] : [];
    })
    .join('\n');
}

const validRecord = {
  type: 'evidence',
  status: 'partial',
  evidenceLevel: 'unit-test',
};

test('relation kinds are a closed six-value machine contract', () => {
  const typesSource = readSource('src/lib/types.ts');
  const declaration = /WIKI_RELATION_KINDS\s*=\s*\[([\s\S]*?)\]\s*as const/u.exec(typesSource);

  assert.ok(declaration, 'types.ts must export WIKI_RELATION_KINDS as a const tuple');
  const kinds = [...declaration[1].matchAll(/['"]([^'"]+)['"]/gu)].map((match) => match[1]);
  assert.deepEqual(kinds, [
    'related',
    'supports',
    'depends-on',
    'implements',
    'supersedes',
    'contrasts',
  ]);
});

test('relation audit rejects malformed and non-public edges with actionable diagnostics', () => {
  const context = {
    publicSlugs: new Set(['Architecture', 'Overview']),
    allSlugs: new Set(['Architecture', 'Overview', 'Wiki-Ops-Sync']),
  };
  const cases = [
    { name: 'unknown kind', relations: ['resembles:Architecture'] },
    { name: 'empty target', relations: ['supports:'] },
    { name: 'self edge', relations: ['related:Overview'] },
    { name: 'duplicate edge', relations: ['supports:Architecture', 'supports:Architecture'] },
    { name: 'missing target', relations: ['depends-on:Missing-Document'] },
    { name: 'non-public target', relations: ['implements:Wiki-Ops-Sync'] },
  ];

  const diagnostics = cases.map(({ name, relations }) => {
    const violations = frontmatterAudit.auditWikiFrontmatterRecord(
      'Overview',
      { ...validRecord, relations },
      context,
    );
    return {
      name,
      relationViolations: violations
        .filter((violation) => violation.field === 'relations')
        .map((violation) => violation.message),
    };
  });

  for (const diagnostic of diagnostics) {
    assert.equal(
      diagnostic.relationViolations.length,
      1,
      `${diagnostic.name} must produce one relations diagnostic`,
    );
    assert.match(diagnostic.relationViolations[0], /^Overview\.relations:/u);
  }
});

test('relationship graph derives exact backlinks from typed outgoing edges', () => {
  assert.equal(
    typeof frontmatterAudit.buildWikiRelationshipGraph,
    'function',
    'wiki-frontmatter-audit must export buildWikiRelationshipGraph',
  );

  const graph = frontmatterAudit.buildWikiRelationshipGraph([
    { slug: 'Overview', relations: ['supports:Architecture', 'related:Evidence'] },
    { slug: 'Architecture', relations: ['depends-on:Evidence'] },
    { slug: 'Evidence', relations: [] },
  ]);

  assert.deepEqual(graph.get('Evidence'), {
    outgoing: [],
    backlinks: [
      { kind: 'related', sourceSlug: 'Overview' },
      { kind: 'depends-on', sourceSlug: 'Architecture' },
    ],
  });
  assert.deepEqual(graph.get('Architecture')?.backlinks, [
    { kind: 'supports', sourceSlug: 'Overview' },
  ]);
});

test('task navigation exposes stable machine IDs with reader-facing labels', () => {
  const source = readTreeSource('src');
  const tasks = [
    ['understand-system', 'Understand the system'],
    ['trace-ai-decisions', 'Trace AI decisions'],
    ['debug-runtime', 'Debug runtime behaviour'],
    ['inspect-evidence', 'Inspect evidence'],
    ['operate-and-reflect', 'Operate and reflect'],
  ];

  for (const [id, label] of tasks) {
    assert.match(source, new RegExp(`['"]${id}['"]`, 'u'), `missing task ID ${id}`);
    assert.match(source, new RegExp(`['"]${label}['"]`, 'u'), `missing task label ${label}`);
  }
});

test('relative Markdown document links resolve to SPA document and section routes', () => {
  assert.equal(
    typeof markdownParse.resolveWikiMarkdownHref,
    'function',
    'markdownParse must export resolveWikiMarkdownHref',
  );

  assert.equal(markdownParse.resolveWikiMarkdownHref('./Architecture.md'), '#/Architecture');
  assert.equal(
    markdownParse.resolveWikiMarkdownHref('./AI-Pipeline.md#벤치마크'),
    '#/AI-Pipeline/%EB%B2%A4%EC%B9%98%EB%A7%88%ED%81%AC',
  );
  assert.equal(markdownParse.resolveWikiMarkdownHref('https://example.com/reference'), null);
  assert.equal(markdownParse.resolveWikiMarkdownHref('./Architecture.txt'), null);
});

test('document surface exposes a concise answer and truthful verification state', () => {
  const source = readTreeSource('src');

  assert.match(source, /\.summary/u, 'document surface must consume the canonical summary');
  assert.match(source, /\.status/u, 'document surface must expose document status');
  assert.match(source, /\.evidenceLevel/u, 'document surface must expose evidence level');
  assert.match(source, /\.verifiedAt/u, 'document surface must expose verification date or gap');
  assert.match(source, /핵심 답변/u, 'concise answer needs a reader-facing label');
  assert.match(source, /문서 상태/u, 'document status needs a reader-facing label');
  assert.match(source, /근거 수준/u, 'evidence level needs a reader-facing label');
  assert.match(source, /검증/u, 'verification state needs a reader-facing label');
});
