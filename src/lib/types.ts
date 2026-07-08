export type WikiCategory =
  | 'Project'
  | '면접·이력서 정리'
  | 'Architecture'
  | 'AI Pipeline'
  | 'Backend'
  | 'Frontend'
  | 'Infra'
  | 'Experiments'
  | 'Bugs'
  | 'ADR'
  | 'Glossary'
  | '01. Project Overview (프로젝트 개요)'
  | '02. AI & Data Pipeline (AI 및 데이터 처리)'
  | '03. Streaming & Sync (스트리밍 및 동기화)'
  | '04. Knowledge Base (위키 및 검색)'
  | '05. Management & Retrospective (운영 및 회고)';

export type Frontmatter = {
  readonly title: string;
  readonly navTitle?: string;
  readonly shortTitle?: string;
  readonly category: WikiCategory;
  readonly tags: readonly string[];
  readonly relatedDocs: readonly string[];
  readonly relatedFiles: readonly string[];
  readonly updatedAt: string;
  readonly description?: string;
  readonly summary?: string;
  readonly order?: number;
  readonly sourcePath?: string;
  readonly relatedSlugs?: readonly string[];
  readonly entities?: readonly string[];
};

export type WikiDocument = Frontmatter & {
  readonly slug: string;
  readonly body: string;
  readonly excerpt: string;
  readonly headings: readonly Heading[];
};

export type Heading = {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
};

export type SearchDocument = Frontmatter & {
  readonly slug: string;
  readonly displayTitle: string;
  readonly excerpt: string;
  readonly text: string;
};

export type SearchResult = SearchDocument & {
  readonly score: number;
};

export function getDisplayTitle(document: {
  readonly navTitle?: string;
  readonly shortTitle?: string;
  readonly title?: string;
  readonly slug?: string;
}): string {
  return document.navTitle ?? document.shortTitle ?? document.title ?? document.slug ?? '';
}
