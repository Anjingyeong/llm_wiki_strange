import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const wikiRoot = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(wikiRoot, 'content');
const outputPath = join(wikiRoot, 'src', 'generated', 'searchIndex.ts');

const requiredKeys = ['title', 'category', 'updatedAt'];

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
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  for (const key of requiredKeys) {
    if (!data[key]) {
      throw new Error(`${fileName} is missing required frontmatter key: ${key}`);
    }
  }

  return { data, body: match[2] };
}

function excerptFrom(body) {
  const EXCERPT_MAX = 220;
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= EXCERPT_MAX) {
    return plain;
  }

  // Cut at the last whitespace before EXCERPT_MAX to avoid mid-word truncation
  const cut = plain.lastIndexOf(' ', EXCERPT_MAX);
  const end = cut > 0 ? cut : EXCERPT_MAX;
  return plain.slice(0, end) + '…';
}

function searchableText(body) {
  return body
    .replace(/```(\w+)?\r?\n([\s\S]*?)```/g, ' $1 $2 ')
    .replace(/[#>*`|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const entries = [];
const files = (await readdir(contentDir)).filter((file) => file.endsWith('.md')).sort();

for (const file of files) {
  const raw = await readFile(join(contentDir, file), 'utf8');
  const parsed = parseFrontmatter(raw, file);
  const slug = file.replace(/\.md$/, '');
  entries.push({
    slug,
    title: parsed.data.title,
    category: parsed.data.category,
    tags: parsed.data.tags ?? [],
    relatedDocs: parsed.data.relatedDocs ?? [],
    relatedFiles: parsed.data.relatedFiles ?? [],
    updatedAt: parsed.data.updatedAt,
    excerpt: excerptFrom(parsed.body),
    text: searchableText(parsed.body),
  });
}

const output = `import type { SearchDocument } from '../lib/types';\n\nexport const searchIndex = ${JSON.stringify(entries)} satisfies readonly SearchDocument[];\n`;

await writeFile(outputPath, output, 'utf8');
console.log(`Generated ${relative(wikiRoot, outputPath)} with ${entries.length} documents.`);
