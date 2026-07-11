/**
 * SHA-256 corpus hash over sorted content/*.md paths + file bytes.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * @param {string} contentDir absolute path to content/
 * @param {string} [root] wiki root for relative paths in hash
 */
export async function computeCorpusHash(contentDir, root = contentDir) {
  const files = (await readdir(contentDir))
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b));

  const hash = createHash('sha256');
  for (const file of files) {
    const abs = join(contentDir, file);
    const rel = relative(root, abs).replace(/\\/g, '/');
    const bytes = await readFile(abs);
    hash.update(rel);
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }
  return {
    corpusHash: hash.digest('hex'),
    documentCount: files.length,
    slugs: files.map((f) => f.replace(/\.md$/, '')),
  };
}
