/**
 * Single source of truth for `category:` values allowed in content/*.md frontmatter.
 * Sidebar MOC groups (01. Project Overview …) live in documents.ts as `sidebarMocCategories`.
 */
export const WIKI_FRONTMATTER_CATEGORIES = [
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
  'Evidence',
] as const;

export type WikiFrontmatterCategory = (typeof WIKI_FRONTMATTER_CATEGORIES)[number];

export function isWikiFrontmatterCategory(value: string): value is WikiFrontmatterCategory {
  return (WIKI_FRONTMATTER_CATEGORIES as readonly string[]).includes(value);
}