import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const navigationSource = readFileSync(join(root, 'src/lib/wikiTaskNavigation.ts'), 'utf8');
const sidebarSource = readFileSync(join(root, 'src/components/Sidebar.tsx'), 'utf8');
const searchIndex = JSON.parse(readFileSync(join(root, 'src/generated/searchIndex.json'), 'utf8'));

function parseTaskDefinitions() {
  return [...navigationSource.matchAll(
    /id: '([^']+)',\s*label: '([^']+)',\s*slugs: \[([\s\S]*?)\]/gu,
  )].map((match) => ({
    id: match[1],
    label: match[2],
    slugs: [...match[3].matchAll(/'([^']+)'/gu)].map((slugMatch) => slugMatch[1]),
  }));
}

test('task navigation defines exactly five stable reader tasks', () => {
  const definitions = parseTaskDefinitions();
  assert.deepEqual(definitions.map(({ id, label }) => ({ id, label })), [
    { id: 'understand-system', label: 'Understand the system' },
    { id: 'trace-ai-decisions', label: 'Trace AI decisions' },
    { id: 'debug-runtime', label: 'Debug runtime behaviour' },
    { id: 'inspect-evidence', label: 'Inspect evidence' },
    { id: 'operate-and-reflect', label: 'Operate and reflect' },
  ]);
});

test('task navigation covers every public document exactly once with Overview first', () => {
  const definitions = parseTaskDefinitions();
  const slugs = definitions.flatMap((definition) => definition.slugs);
  const publicSlugs = searchIndex.documents.map((document) => document.slug);

  assert.equal(slugs.length, 48);
  assert.equal(new Set(slugs).size, 48);
  assert.deepEqual([...slugs].sort(), [...publicSlugs].sort());
  assert.equal(slugs[0], 'Overview');
});

test('sidebar uses accessible task navigation and decorative SVG icons', () => {
  assert.match(sidebarSource, /aria-label="Browse wiki by task"/u);
  assert.match(sidebarSource, /aria-current=\{document\.slug === activeSlug \? 'page'/u);
  assert.match(sidebarSource, /<WikiNavIcon name="task"/u);
  assert.match(sidebarSource, /<WikiNavIcon name="document"/u);
  assert.doesNotMatch(sidebarSource, /[📁📂📄▶▼]/u);
});
