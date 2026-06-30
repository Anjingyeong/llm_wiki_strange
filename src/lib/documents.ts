import { parseWikiDocument } from './frontmatter';
import type { WikiCategory, WikiDocument } from './types';

const rawModules = import.meta.glob<string>('../../content/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const categoryOrder: readonly WikiCategory[] = [
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

export const documents = Object.entries(rawModules)
  .map(([filePath, raw]) => parseWikiDocument(filePath, raw))
  .sort((left, right) => {
    const categoryDiff = categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category);
    return categoryDiff === 0 ? left.title.localeCompare(right.title) : categoryDiff;
  });

export const documentsBySlug = new Map(documents.map((document) => [document.slug, document]));

export const documentsByCategory = categoryOrder.map((category) => ({
  category,
  documents: documents.filter((document) => document.category === category),
}));

export function getInitialDocument(): WikiDocument {
  return documentsBySlug.get('Overview') ?? documents[0] ?? {
    slug: 'missing',
    title: '문서 없음',
    category: 'Project',
    tags: [],
    relatedDocs: [],
    relatedFiles: [],
    updatedAt: '',
    body: '# 문서 없음',
    excerpt: '',
    headings: [],
  };
}
