/**
 * Slugs included in client search + operational RAG (matches generate-search-index + documents.ts).
 * archived / wikiVisibility: internal are excluded from indexes but remain on disk.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseWikiSourceDocument } from './wiki-source-document.mjs';

export function isExcludedFromPublicIndex(data) {
  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  const visibility = typeof data.wikiVisibility === 'string'
    ? data.wikiVisibility.trim().toLowerCase()
    : '';
  return status === 'archived' || visibility === 'internal';
}

/**
 * @param {string} contentDir
 * @returns {Promise<{ slugs: string[], documentCount: number }>}
 */
export async function listIndexableContentSlugs(contentDir) {
  const files = (await readdir(contentDir)).filter((f) => f.endsWith('.md')).sort();
  const slugs = [];
  for (const file of files) {
    const raw = await readFile(join(contentDir, file), 'utf8');
    const { data } = parseWikiSourceDocument(raw, file);
    if (isExcludedFromPublicIndex(data)) continue;
    slugs.push(file.replace(/\.md$/, ''));
  }
  return { slugs, documentCount: slugs.length };
}
