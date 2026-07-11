#!/usr/bin/env node
/**
 * Build-time freshness gate:
 * - searchIndex must include all content/*.md slugs (esp. ED-*)
 * - operational ragVectorIndex must include those slugs
 * - optional: corpus file mtime vs generatedAt age warning
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectStaleIndex, summarizeIndex } from './lib/rag/index-meta.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(root, 'content');
const searchJson = join(root, 'src/generated/searchIndex.json');
const ragPath = join(root, 'data/ragVectorIndex.json');
const failOnMissing = process.env.INDEX_FRESHNESS_STRICT !== 'false';

const mdSlugs = (await readdir(contentDir))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''))
  .sort();

const searchIndex = JSON.parse(await readFile(searchJson, 'utf8'));
const searchSlugs = new Set(searchIndex.map((d) => d.slug));
const rag = JSON.parse(await readFile(ragPath, 'utf8'));
const stale = detectStaleIndex(rag, { expectedSlugs: mdSlugs.filter((s) => s.startsWith('ED-')) });

const missingSearch = mdSlugs.filter((s) => !searchSlugs.has(s));
const missingRag = mdSlugs.filter((s) => !stale.meta.slugs.includes(s));

const report = {
  contentDocuments: mdSlugs.length,
  searchDocuments: searchSlugs.size,
  rag: summarizeIndex(rag),
  missingInSearchIndex: missingSearch,
  missingInRagIndex: missingRag,
  stale: stale.stale,
  staleReasons: stale.reasons,
};

console.log(JSON.stringify(report, null, 2));

const hardFail =
  failOnMissing
  && (missingSearch.length > 0 || missingRag.some((s) => s.startsWith('ED-')));

if (hardFail) {
  console.error('INDEX FRESHNESS CHECK FAILED');
  process.exit(1);
}

// Soft warn for non-ED missing (some docs may be intentionally excluded)
if (missingRag.length) {
  console.warn('WARN: some content slugs missing from RAG:', missingRag.slice(0, 20));
}
