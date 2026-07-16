import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');

function normalize(raw) {
  return raw.replace(/^\uFEFF/, '').replace(/^\s+/, '');
}

function hasValidFrontmatter(raw) {
  const n = normalize(raw);
  if (/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.test(n)) return true;
  if (/^---\r?\n([\s\S]*?)\r?\n---\s*$/.test(n)) return true;
  return false;
}

const files = (await readdir(contentDir)).filter((f) => f.endsWith('.md')).sort();
const bad = [];

for (const file of files) {
  const raw = await readFile(join(contentDir, file), 'utf8');
  if (!hasValidFrontmatter(raw)) {
    bad.push({ file, preview: JSON.stringify(normalize(raw).slice(0, 100)) });
  }
}

if (bad.length) {
  console.error('Frontmatter audit FAIL:', bad.length);
  for (const b of bad) console.error(b);
  process.exit(1);
}
console.log(`Frontmatter audit OK: ${files.length} files`);