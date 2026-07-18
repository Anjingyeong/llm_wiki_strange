import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Given the aggregate index command When generation runs Then UX metadata reads the refreshed RAG manifest', async () => {
  // Given: the package scripts consumed by local and CI generation flows.
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  // When: the aggregate command is decomposed into its executable stages.
  const stages = packageJson.scripts['generate:index'].split(' && ');

  // Then: search and RAG complete before UX metadata reads their manifests.
  assert.deepEqual(stages, [
    'node scripts/generate-search-index.mjs',
    'npm run rag:index',
    'node scripts/generate-wiki-ux-meta.mjs',
  ]);
  assert.equal(packageJson.scripts.dev.startsWith('npm run generate:index && '), true);
  assert.equal(packageJson.scripts.build.startsWith('npm run generate:index && npm run check:index && '), true);
});
