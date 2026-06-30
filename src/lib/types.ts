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
  | 'Glossary';

export type Frontmatter = {
  readonly title: string;
  readonly category: WikiCategory;
  readonly tags: readonly string[];
  readonly relatedDocs: readonly string[];
  readonly relatedFiles: readonly string[];
  readonly updatedAt: string;
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
  readonly excerpt: string;
  readonly text: string;
};

export type SearchResult = SearchDocument & {
  readonly score: number;
};
