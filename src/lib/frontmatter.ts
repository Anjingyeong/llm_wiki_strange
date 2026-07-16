import {
  parseWikiFrontmatterFields,
  parseWikiFrontmatterList,
  splitWikiFrontmatter,
  stripWikiFrontmatterQuotes,
} from './wikiFrontmatterCore.mjs';
import type { Frontmatter, Heading, WikiDocument } from './types';
import type { WikiCategory } from './types';
import { isWikiFrontmatterCategory } from './wikiCategories';
import { allocateHeadingIds } from './wikiHeadings.mjs';

class FrontmatterError extends Error {
  constructor(readonly filePath: string, message: string) {
    super(`${filePath}: ${message}`);
    this.name = 'FrontmatterError';
  }
}

function parseCategory(value: string, filePath: string): WikiCategory {
  const normalized = stripWikiFrontmatterQuotes(value);
  if (isWikiFrontmatterCategory(normalized)) {
    return normalized;
  }
  throw new FrontmatterError(filePath, `unknown category "${normalized}"`);
}

function parseFrontmatterBlock(block: string, filePath: string): Frontmatter {
  const values = parseWikiFrontmatterFields(block);
  const title = values.get('title');
  const category = values.get('category');
  const updatedAt = values.get('updatedAt');
  if (!title || !category || !updatedAt) {
    throw new FrontmatterError(filePath, 'title, category, and updatedAt are required');
  }

  const summary = values.get('summary');
  const desc = values.get('description') ?? summary ?? values.get('intro');
  const order = values.get('order');
  const navTitle = values.get('navTitle');
  const shortTitle = values.get('shortTitle');
  const displayTitle = values.get('displayTitle');

  return {
    title: stripWikiFrontmatterQuotes(title),
    ...(navTitle ? { navTitle: stripWikiFrontmatterQuotes(navTitle) } : {}),
    ...(shortTitle ? { shortTitle: stripWikiFrontmatterQuotes(shortTitle) } : {}),
    ...(displayTitle ? { displayTitle: stripWikiFrontmatterQuotes(displayTitle) } : {}),
    category: parseCategory(category, filePath),
    tags: parseWikiFrontmatterList(values.get('tags') ?? ''),
    relatedDocs: parseWikiFrontmatterList(values.get('relatedDocs') ?? ''),
    relatedFiles: parseWikiFrontmatterList(values.get('relatedFiles') ?? ''),
    updatedAt: stripWikiFrontmatterQuotes(updatedAt),
    ...(summary ? { summary: stripWikiFrontmatterQuotes(summary) } : {}),
    ...(order ? { order: Number.parseInt(order, 10) } : {}),
    relatedSlugs: parseWikiFrontmatterList(values.get('relatedSlugs') ?? ''),
    entities: parseWikiFrontmatterList(values.get('entities') ?? ''),
    ...(desc ? { description: stripWikiFrontmatterQuotes(desc) } : {}),
  };
}

export function slugify(text: string): string {
  return allocateHeadingIds([{ text, level: 2 }])[0]?.id ?? 'section';
}

function collectHeadings(body: string): readonly Heading[] {
  const headings = body
    .split(/\r?\n/)
    .map((line) => {
      const match = /^(#{2,3})\s+(.+)$/.exec(line);
      if (!match?.[1] || !match[2]) return null;
      return {
        text: match[2],
        level: match[1].length === 2 ? 2 : 3,
      };
    })
    .filter((heading): heading is { text: string; level: 2 | 3 } => heading !== null);

  return allocateHeadingIds(headings);
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
  const split = splitWikiFrontmatter(raw);
  if (!split) {
    throw new FrontmatterError(filePath, 'document must start with YAML frontmatter');
  }
  const { frontmatter, body } = split;

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
