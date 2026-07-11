#!/usr/bin/env node
/**
 * Build-time freshness gate:
 * - corpusHash(content/*.md) must match search + RAG metadata
 * - every content slug must appear in search and RAG indexes
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeCorpusHash } from './lib/corpus-hash.mjs';
import { detectStaleIndex, summarizeIndex } from './lib/rag/index-meta.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(root, 'content');
const searchJson = join(root, 'src/generated/searchIndex.json');
const ragPath = join(root, 'data/ragVectorIndex.json');

const live = await computeCorpusHash(contentDir, root);
const searchBundle = JSON.parse(await readFile(searchJson, 'utf8'));
const searchDocs = Array.isArray(searchBundle) ? searchBundle : (searchBundle.documents ?? []);
const searchMeta = Array.isArray(searchBundle) ? {} : (searchBundle.meta ?? {});
const searchSlugs = new Set(searchDocs.map((d) => d.slug));
const rag = JSON.parse(await readFile(ragPath, 'utf8'));
const ragMeta = summarizeIndex(rag);

const missingSearch = live.slugs.filter((s) => !searchSlugs.has(s));
const missingRag = live.slugs.filter((s) => !ragMeta.slugs.includes(s));
const searchHashOk = searchMeta.corpusHash === live.corpusHash;
const ragHashOk = rag.corpusHash === live.corpusHash;
const stale = detectStaleIndex(rag, {
  expectedSlugs: live.slugs,
  expectedCorpusHash: live.corpusHash,
});

const report = {
  liveCorpusHash: live.corpusHash,
  searchCorpusHash: searchMeta.corpusHash ?? null,
  ragCorpusHash: rag.corpusHash ?? null,
  searchHashOk,
  ragHashOk,
  contentDocuments: live.documentCount,
  searchDocuments: searchSlugs.size,
  ragDocumentCount: ragMeta.documentCount,
  missingInSearchIndex: missingSearch,
  missingInRagIndex: missingRag,
  stale: stale.stale,
  staleReasons: stale.reasons,
};

console.log(JSON.stringify(report, null, 2));

const hardFail =
  !searchHashOk
  || !ragHashOk
  || missingSearch.length > 0
  || missingRag.length > 0
  || !ragMeta.chunkCount;

if (hardFail) {
  console.error('INDEX FRESHNESS CHECK FAILED');
  process.exit(1);
}
