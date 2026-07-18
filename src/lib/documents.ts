import { parseWikiDocument } from './frontmatter';
import type {
  WikiCategory,
  WikiDocument,
  WikiRelationshipGraphEntry,
  WikiRelationKind,
} from './types';
import {
  extractWikiVisibility,
  parseWikiFrontmatterFields,
  splitWikiFrontmatter,
  stripWikiFrontmatterQuotes,
} from './wikiFrontmatterCore.mjs';
import { compareWikiDocumentsByTask, groupWikiDocumentsByTask } from './wikiTaskNavigation';
import { buildWikiRelationshipGraph } from './wikiRelationships.mjs';
import { WIKI_RELATION_KINDS } from './types';

type RawRelationshipGraphEntry = {
  readonly outgoing: readonly { readonly kind: string; readonly targetSlug: string }[];
  readonly backlinks: readonly { readonly kind: string; readonly sourceSlug: string }[];
};

function requireRelationKind(kind: string): WikiRelationKind {
  const knownKind = WIKI_RELATION_KINDS.find((candidate) => candidate === kind);
  if (!knownKind) throw new Error(`Unknown wiki relation kind: ${kind}`);
  return knownKind;
}

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

const rawRelationshipGraph = buildWikiRelationshipGraph(documents) as ReadonlyMap<
  string,
  RawRelationshipGraphEntry
>;

export const documentRelationshipGraph = new Map<string, WikiRelationshipGraphEntry>(
  documents.map((document) => {
    const entry = rawRelationshipGraph.get(document.slug);
    return [
      document.slug,
      {
        outgoing: (entry?.outgoing ?? []).map((relation) => ({
          kind: requireRelationKind(relation.kind),
          targetSlug: relation.targetSlug,
        })),
        backlinks: (entry?.backlinks ?? []).map((backlink) => ({
          kind: requireRelationKind(backlink.kind),
          sourceSlug: backlink.sourceSlug,
        })),
      },
    ];
  }),
);

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
