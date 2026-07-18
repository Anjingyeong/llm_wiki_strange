import { resolveDisplayTitle } from './wikiTitle.mjs';
import type { WikiFrontmatterCategory } from './wikiCategories';

/** YAML `category:` on each wiki page (see wikiCategories.ts). */
export type WikiCategory = WikiFrontmatterCategory;

export const WIKI_DOCUMENT_TYPES = [
  'architecture',
  'baseline',
  'contract',
  'daily-log',
  'decision',
  'evidence',
  'experiment',
  'incident',
  'meta',
  'overview',
  'plan',
  'reference',
  'runbook',
] as const;
export type WikiDocumentType = (typeof WIKI_DOCUMENT_TYPES)[number];

export const WIKI_DOCUMENT_STATUSES = [
  'archived',
  'partial',
  'planned',
  'superseded',
  'verified',
] as const;
export type WikiDocumentStatus = (typeof WIKI_DOCUMENT_STATUSES)[number];

export const WIKI_EVIDENCE_LEVELS = [
  'code-only',
  'unit-test',
  'offline-benchmark',
  'live-canary',
  'production',
] as const;
export type WikiEvidenceLevel = (typeof WIKI_EVIDENCE_LEVELS)[number];

export const WIKI_RELATION_KINDS = [
  'related',
  'supports',
  'depends-on',
  'implements',
  'supersedes',
  'contrasts',
] as const;
export type WikiRelationKind = (typeof WIKI_RELATION_KINDS)[number];

export type WikiRelation = {
  readonly kind: WikiRelationKind;
  readonly targetSlug: string;
};

export type WikiBacklink = {
  readonly kind: WikiRelationKind;
  readonly sourceSlug: string;
};

export type WikiRelationshipGraphEntry = {
  readonly outgoing: readonly WikiRelation[];
  readonly backlinks: readonly WikiBacklink[];
};

export type WikiTaskNavigationId =
  | 'understand-system'
  | 'trace-ai-decisions'
  | 'debug-runtime'
  | 'inspect-evidence'
  | 'operate-and-reflect';

export type WikiTaskNavigationGroup = {
  readonly id: WikiTaskNavigationId;
  readonly label: string;
  readonly documents: readonly WikiDocument[];
};

export type Frontmatter = {
  readonly title: string;
  readonly type?: WikiDocumentType;
  readonly status?: WikiDocumentStatus;
  readonly evidenceLevel?: WikiEvidenceLevel;
  readonly verifiedAt?: string;
  readonly canonicalFor?: string | null;
  readonly supersedes?: readonly string[];
  readonly supersededBy?: string;
  readonly relations?: readonly string[];
  readonly navTitle?: string;
  readonly shortTitle?: string;
  readonly displayTitle?: string;
  readonly category: WikiCategory;
  readonly tags?: readonly string[];
  readonly relatedDocs?: readonly string[];
  readonly relatedFiles?: readonly string[];
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

export type SearchHeading = {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
  readonly searchableText: string;
};

export type SearchDocument = Frontmatter & {
  readonly slug: string;
  readonly displayTitle: string;
  readonly excerpt: string;
  readonly text: string;
  readonly headings?: readonly SearchHeading[];
};

export type SearchResult = SearchDocument & {
  readonly score: number;
  readonly matchReasons?: readonly string[];
  readonly snippet?: string;
  readonly matchedSectionId?: string | null;
};

export function getDisplayTitle(document: {
  readonly displayTitle?: string;
  readonly navTitle?: string;
  readonly shortTitle?: string;
  readonly title?: string;
  readonly slug?: string;
}): string {
  return resolveDisplayTitle(document);
}
