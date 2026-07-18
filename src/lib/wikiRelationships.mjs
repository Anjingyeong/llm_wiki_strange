export const WIKI_RELATION_KINDS = [
  'related',
  'supports',
  'depends-on',
  'implements',
  'supersedes',
  'contrasts',
];

const RELATION_KIND_SET = new Set(WIKI_RELATION_KINDS);

export function parseWikiRelation(value) {
  if (typeof value !== 'string') return null;
  const separator = value.indexOf(':');
  if (separator < 0) return null;

  const kind = value.slice(0, separator).trim();
  const targetSlug = value.slice(separator + 1).trim();
  if (!RELATION_KIND_SET.has(kind) || !targetSlug) return null;

  return { kind, targetSlug };
}

export function auditWikiRelations(slug, relations, context = {}) {
  if (relations === undefined) return [];
  if (!Array.isArray(relations)) {
    return [`${slug}.relations: expected a list of kind:target-slug records`];
  }

  const diagnostics = [];
  const seen = new Set();
  for (const value of relations) {
    const parsed = parseWikiRelation(value);
    if (!parsed) {
      diagnostics.push(`${slug}.relations: ${JSON.stringify(value)} must use a known kind and non-empty target`);
      continue;
    }

    const edgeKey = `${parsed.kind}:${parsed.targetSlug}`;
    if (seen.has(edgeKey)) {
      diagnostics.push(`${slug}.relations: duplicate edge ${edgeKey}`);
      continue;
    }
    seen.add(edgeKey);

    if (parsed.targetSlug === slug) {
      diagnostics.push(`${slug}.relations: self edge ${edgeKey} is not allowed`);
    } else if (context.allSlugs && !context.allSlugs.has(parsed.targetSlug)) {
      diagnostics.push(`${slug}.relations: target ${parsed.targetSlug} does not exist`);
    } else if (context.publicSlugs && !context.publicSlugs.has(parsed.targetSlug)) {
      diagnostics.push(`${slug}.relations: target ${parsed.targetSlug} is not public`);
    }
  }
  return diagnostics;
}

export function buildWikiRelationshipGraph(records) {
  const graph = new Map();
  for (const record of records) {
    graph.set(record.slug, { outgoing: [], backlinks: [] });
  }

  for (const record of records) {
    const source = graph.get(record.slug);
    if (!source) continue;
    for (const value of record.relations ?? []) {
      const relation = parseWikiRelation(value);
      if (!relation) continue;
      source.outgoing.push(relation);

      const target = graph.get(relation.targetSlug);
      if (target) {
        target.backlinks.push({ kind: relation.kind, sourceSlug: record.slug });
      }
    }
  }

  return graph;
}
