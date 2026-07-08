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
  'Backend',
  'ADR',
  '면접·이력서 정리',
  'Glossary',
] as const;

const flowGroups = [
  { label: '개요', min: 100, max: 199 },
  { label: '아키텍처', min: 200, max: 299 },
  { label: 'AI 파이프라인', min: 300, max: 399 },
  { label: '스트리밍', min: 400, max: 499 },
  { label: '프레임 동기화', min: 500, max: 599 },
  { label: '모델 개선', min: 600, max: 699 },
  { label: '버그 기록', min: 700, max: 799 },
  { label: '운영 안정화', min: 800, max: 899 },
  { label: '회고/확장', min: 900, max: 999 },
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
