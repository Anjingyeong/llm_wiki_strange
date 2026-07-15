/**
 * Slugs included in client search + operational RAG (matches generate-search-index + documents.ts).
 * archived / wikiVisibility: internal are excluded from indexes but remain on disk.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

function stripOuterQuotes(value) {
  let normalized = String(value).trim();
  while (
    normalized.length >= 2
    && ((normalized.startsWith('"') && normalized.endsWith('"'))
      || (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function parseFrontmatterFlags(raw) {
  const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = stripOuterQuotes(value);
  }
  return data;
}

export function isExcludedFromPublicIndex(data) {
  return data.status === 'archived' || data.wikiVisibility === 'internal';
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
    const data = parseFrontmatterFlags(raw);
    if (isExcludedFromPublicIndex(data)) continue;
    slugs.push(file.replace(/\.md$/, ''));
  }
  return { slugs, documentCount: slugs.length };
}