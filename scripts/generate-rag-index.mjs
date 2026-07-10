import { writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildRagIndex,
  buildRagIndexLegacy,
  buildRagIndexStructured,
  mergeIncrementalIndex,
} from './lib/rag-core.mjs';
import { buildIndexManifest, readJsonIfExists, writeIndexManifest } from './lib/rag/index-manifest.mjs';
import { loadWikiDocuments } from './lib/rag/load-documents.mjs';

const wikiRoot = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(wikiRoot, 'content');
const operationalPath = join(wikiRoot, 'data', 'ragVectorIndex.json');
const indexesDir = join(wikiRoot, 'data', 'rag', 'indexes');
const manifestPath = join(wikiRoot, 'data', 'rag', 'index-manifest.json');
const pointerPath = join(wikiRoot, 'data', 'rag', 'current-index.json');

const pointer = await readJsonIfExists(pointerPath);
const schemaVersion =
  process.env.RAG_CHUNK_SCHEMA_VERSION
  || pointer?.chunkSchemaVersion
  || 'legacy-v1';
const writeOperational = process.env.RAG_WRITE_OPERATIONAL !== 'false';

const documents = await loadWikiDocuments(contentDir);

let index;
if (schemaVersion === 'structure-aware-contextual-v1' || schemaVersion === 'structure-aware-contextual') {
  index = buildRagIndexStructured(documents, { contextualPrefix: true });
} else if (schemaVersion === 'structure-aware-v1' || schemaVersion === 'structure-aware') {
  index = buildRagIndexStructured(documents, { contextualPrefix: false });
} else {
  index = buildRagIndexLegacy(documents);
}

const schemaKey = index.chunkSchemaVersion || schemaVersion;
const versionedPath = join(indexesDir, `${schemaKey}.json`);
const previous = await readJsonIfExists(versionedPath);
const merged = mergeIncrementalIndex(previous, index);
index = merged.index;

await mkdir(indexesDir, { recursive: true });
await writeFile(versionedPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

const manifest = buildIndexManifest(index, {
  chunkSchemaVersion: schemaKey,
  indexPath: relative(wikiRoot, versionedPath).replace(/\\/g, '/'),
});
await writeIndexManifest(join(indexesDir, `${schemaKey}.manifest.json`), manifest);

// Operational write: rebuild active pointer schema into ragVectorIndex.json (default).
// Experiments set RAG_WRITE_OPERATIONAL=false to avoid clobbering mid-run.
if (writeOperational) {
  await writeFile(operationalPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await writeIndexManifest(manifestPath, {
    ...manifest,
    indexPath: 'data/ragVectorIndex.json',
  });
  if (!pointer) {
    await writeFile(
      pointerPath,
      `${JSON.stringify({
        chunkSchemaVersion: schemaKey,
        indexPath: 'data/ragVectorIndex.json',
        updatedAt: new Date().toISOString(),
        note: 'Operational default until a candidate is promoted.',
      }, null, 2)}\n`,
      'utf8',
    );
  }
} else {
  await writeIndexManifest(manifestPath, manifest);
}

console.log(
  JSON.stringify(
    {
      schemaVersion: schemaKey,
      chunkCount: index.chunks.length,
      reused: merged.reused,
      rebuilt: merged.rebuilt,
      versionedPath: relative(wikiRoot, versionedPath).replace(/\\/g, '/'),
      operationalWritten: writeOperational && (schemaKey === 'legacy-v1' || (await readJsonIfExists(pointerPath))?.chunkSchemaVersion === schemaKey),
      meanChunkChars: manifest.meanChunkChars,
    },
    null,
    2,
  ),
);
