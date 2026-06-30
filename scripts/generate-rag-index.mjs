import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRagIndex } from './lib/rag-core.mjs';

const wikiRoot = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(wikiRoot, 'content');
const outputPath = join(wikiRoot, 'data', 'ragVectorIndex.json');

function parseFrontmatter(raw, fileName) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`${fileName} is missing frontmatter`);
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = value.replace(/^["']|["']$/g, '');
  }

  return { data, body: match[2] };
}

const documents = [];
const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();
for (const file of files) {
  const raw = await readFile(join(contentDir, file), 'utf8');
  const parsed = parseFrontmatter(raw, file);
  documents.push({
    slug: file.replace(/\.md$/, ''),
    title: parsed.data.title,
    category: parsed.data.category,
    updatedAt: parsed.data.updatedAt,
    body: parsed.body,
  });
}

const index = buildRagIndex(documents);
await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(`Generated ${relative(wikiRoot, outputPath)} with ${index.chunks.length} chunks.`);
