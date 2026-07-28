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

test('task navigation keeps explicit slugs unique and safely assigns newly public documents', () => {
  const definitions = parseTaskDefinitions();
  const explicitSlugs = definitions.flatMap((definition) => definition.slugs);
  const publicSlugs = new Set(searchIndex.documents.map((document) => document.slug));

  assert.equal(new Set(explicitSlugs).size, explicitSlugs.length);
  assert.ok(explicitSlugs.every((slug) => publicSlugs.has(slug)));
  assert.equal(explicitSlugs[0], 'Overview');
  assert.match(navigationSource, /fallbackTaskIndexByCategory/u);
  assert.match(navigationSource, /taskPositionBySlug\.has\(document\.slug\)/u);
  assert.doesNotMatch(navigationSource, /Unmapped public wiki slug/u);
});

test('sidebar uses accessible task navigation and decorative SVG icons', () => {
  assert.match(sidebarSource, /aria-label="Browse wiki by task"/u);
  assert.match(sidebarSource, /aria-current=\{document\.slug === activeSlug \? 'page'/u);
  assert.match(sidebarSource, /<WikiNavIcon name="task"/u);
  assert.match(sidebarSource, /<WikiNavIcon name="document"/u);
  assert.doesNotMatch(sidebarSource, /[📁📂📄▶▼]/u);
});
