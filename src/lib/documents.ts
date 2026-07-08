import { parseWikiDocument } from './frontmatter';
import type { WikiCategory, WikiDocument } from './types';

const rawModules = import.meta.glob<string>('../../content/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const categoryOrder: readonly WikiCategory[] = [
  'Project',
  'Architecture',
  'AI Pipeline',
  'Frontend',
  'Infra',
  'Experiments',
  'Bugs',
  'Project',
  'Architecture',
  'AI Pipeline',
  'Frontend',
  'Infra',
  'Experiments',
  'Bugs',
  'Backend',
  'ADR',
  '면접·이력서 정리',
  'Glossary',
] as const;

type GroupType = 
  | { readonly label: string; readonly min: number; readonly max: number }
  | { readonly label: string; readonly match: (order: number) => boolean };

const flowGroups: readonly GroupType[] = [
  { label: '01. Project Overview (프로젝트 개요)', min: 100, max: 299 },
  { label: '02. AI & Data Pipeline (AI 및 데이터 처리)', match: (o: number) => (o >= 300 && o <= 399) || (o >= 600 && o <= 699) },
  { label: '03. Streaming & Sync (스트리밍 및 동기화)', min: 400, max: 599 },
  { label: '04. Knowledge Base (위키 및 검색)', min: 900, max: 999 },
  { label: '05. Management & Retrospective (운영 및 회고)', min: 700, max: 899 },
] as const;

export const documents = Object.entries(rawModules)
  .map(([filePath, raw]) => parseWikiDocument(filePath, raw))
  .sort((left, right) => {
    const categoryDiff = categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category);
    if (categoryDiff !== 0) {
      return categoryDiff;
    }
    const orderDiff = (left.order ?? 999) - (right.order ?? 999);
    return orderDiff === 0 ? left.title.localeCompare(right.title) : orderDiff;
  });

export const documentsBySlug = new Map(documents.map((document) => [document.slug, document]));

export const documentsByCategory = flowGroups.map((group) => ({
  category: group.label,
  documents: documents.filter((document) => {
    const order = document.order ?? 999;
    if ('match' in group) {
      return group.match(order);
    }
    return order >= group.min && order <= group.max;
  }),
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
