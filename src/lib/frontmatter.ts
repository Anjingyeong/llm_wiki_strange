import type { Frontmatter, Heading, WikiCategory, WikiDocument } from './types';

const categories = [
  'Project',
  '면접·이력서 정리',
  'Architecture',
  'AI Pipeline',
  'Backend',
  'Frontend',
  'Infra',
  'Experiments',
  'Bugs',
  'ADR',
  'Glossary',
] as const;

class FrontmatterError extends Error {
  constructor(readonly filePath: string, message: string) {
    super(`${filePath}: ${message}`);
    this.name = 'FrontmatterError';
  }
}

function parseCategory(value: string, filePath: string): WikiCategory {
  for (const category of categories) {
    if (category === value) {
      return category;
    }
  }
  throw new FrontmatterError(filePath, `unknown category "${value}"`);
}

function parseList(value: string): readonly string[] {
  if (!value.startsWith('[') || !value.endsWith(']')) {
    return value ? [value] : [];
  }
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function parseFrontmatterBlock(block: string, filePath: string): Frontmatter {
  const values = new Map<string, string>();
  for (const line of block.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) {
      continue;
    }
    values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  const title = values.get('title');
  const category = values.get('category');
  const updatedAt = values.get('updatedAt');
  if (!title || !category || !updatedAt) {
    throw new FrontmatterError(filePath, 'title, category, and updatedAt are required');
  }

  const summary = values.get('summary');
  const desc = values.get('description') ?? summary ?? values.get('intro');
  const order = values.get('order');

  return {
    title,
    category: parseCategory(category, filePath),
    tags: parseList(values.get('tags') ?? ''),
    relatedDocs: parseList(values.get('relatedDocs') ?? ''),
    relatedFiles: parseList(values.get('relatedFiles') ?? ''),
    updatedAt,
    ...(summary ? { summary } : {}),
    ...(order ? { order: Number.parseInt(order, 10) } : {}),
    relatedSlugs: parseList(values.get('relatedSlugs') ?? ''),
    entities: parseList(values.get('entities') ?? ''),
    ...(desc ? { description: desc } : {}),
  };
}

export function slugify(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'section';
}

function collectHeadings(body: string): readonly Heading[] {
  return body
    .split(/\r?\n/)
    .map((line): Heading | null => {
      const match = /^(#{2,3})\s+(.+)$/.exec(line);
      const marks = match?.[1];
      const text = match?.[2];
      if (!marks || !text) {
        return null;
      }
      return { id: slugify(text), text, level: marks.length === 2 ? 2 : 3 };
    })
    .filter((heading): heading is Heading => heading !== null);
}

function makeExcerpt(body: string): string {
  const EXCERPT_MAX = 180;
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

export function isExcerptDuplicate(body: string, excerpt: string): boolean {
  if (!excerpt) return false;
  
  const plainBody = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, '')
    .trim();
  
  const cleanExcerpt = excerpt.replace(/…$/, '').replace(/\s+/g, '').trim();
  if (cleanExcerpt.length === 0) return false;
  
  const matchLen = Math.min(30, cleanExcerpt.length, plainBody.length);
  if (matchLen > 0 && plainBody.slice(0, matchLen) === cleanExcerpt.slice(0, matchLen)) {
    return true;
  }
  return false;
}

export function parseWikiDocument(filePath: string, raw: string): WikiDocument {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  const frontmatter = match?.[1];
  const body = match?.[2];
  if (!frontmatter || !body) {
    throw new FrontmatterError(filePath, 'document must start with YAML frontmatter');
  }

  const frontmatterData = parseFrontmatterBlock(frontmatter, filePath);
  const slug = filePath.split('/').pop()?.replace(/\.md$/, '') ?? filePath;
  const sourcePath = `content/${slug}.md`;
  return {
    ...frontmatterData,
    slug,
    sourcePath,
    body,
    excerpt: frontmatterData.description ?? makeExcerpt(body),
    headings: collectHeadings(body),
  };
}
