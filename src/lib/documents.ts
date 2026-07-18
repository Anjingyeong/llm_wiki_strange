import { parseWikiDocument } from './frontmatter';
import type { WikiCategory, WikiDocument } from './types';
import {
  extractWikiVisibility,
  parseWikiFrontmatterFields,
  splitWikiFrontmatter,
  stripWikiFrontmatterQuotes,
} from './wikiFrontmatterCore.mjs';
import { compareWikiDocumentsByTask, groupWikiDocumentsByTask } from './wikiTaskNavigation';

function isArchivedWikiDoc(raw: string): boolean {
  const split = splitWikiFrontmatter(raw);
  if (!split) return false;
  const fields = parseWikiFrontmatterFields(split.frontmatter);
  const status = stripWikiFrontmatterQuotes(fields.get('status') ?? '').toLowerCase();
  const visibility = stripWikiFrontmatterQuotes(extractWikiVisibility(fields) ?? '').toLowerCase();
  return status === 'archived' || visibility === 'internal';
}

const rawModules = import.meta.glob<string>('../../content/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

export const documents = Object.entries(rawModules)
  .filter(([, raw]) => !isArchivedWikiDoc(raw))
  .map(([filePath, raw]) => {
    const text = typeof raw === 'string' ? raw : '';
    return parseWikiDocument(filePath, text);
  })
  .sort(compareWikiDocumentsByTask);

export const documentsBySlug = new Map(documents.map((document) => [document.slug, document]));

export const documentsByTask = groupWikiDocumentsByTask(documents);

export function getInitialDocument(): WikiDocument {
  return documentsBySlug.get('Overview') ?? documents[0] ?? {
    slug: 'missing',
    title: '문서 없음',
    category: 'Project' as WikiCategory,
    tags: [],
    relatedDocs: [],
    relatedFiles: [],
    updatedAt: '',
    body: '# 문서 없음',
    excerpt: '',
    headings: [],
  };
}
