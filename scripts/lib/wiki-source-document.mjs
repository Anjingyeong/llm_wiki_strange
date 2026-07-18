import {
  parseWikiFrontmatterFields,
  parseWikiFrontmatterList,
  splitWikiFrontmatter,
  stripWikiFrontmatterQuotes,
} from '../../src/lib/wikiFrontmatterCore.mjs';

const LIST_FIELDS = [
  'entities',
  'redirectTo',
  'relatedDocs',
  'relatedFiles',
  'relatedSlugs',
  'relations',
  'supersedes',
  'tags',
];

/**
 * Parse one root wiki source into the shared scalar/list representation used by generators.
 * @param {string} raw
 * @param {string} fileName
 * @returns {{ data: Record<string, string | string[] | null>, body: string }}
 */
export function parseWikiSourceDocument(raw, fileName) {
  const parsed = splitWikiFrontmatter(raw);
  if (!parsed) {
    throw new Error(`${fileName} is missing frontmatter`);
  }

  const fields = parseWikiFrontmatterFields(parsed.frontmatter);
  const data = {};
  for (const [key, value] of fields) {
    data[key] = typeof value === 'string' ? stripWikiFrontmatterQuotes(value) : value;
  }
  for (const key of LIST_FIELDS) {
    const value = fields.get(key);
    if (typeof value === 'string') {
      data[key] = parseWikiFrontmatterList(value);
    }
  }

  return { data, body: parsed.body };
}

/**
 * Keep the machine contract explicit at every generated-document boundary.
 * @param {Record<string, string | string[] | null>} data
 */
export function extractWikiMachineMetadata(data) {
  return {
    type: data.type,
    status: data.status,
    evidenceLevel: data.evidenceLevel,
    verifiedAt: data.verifiedAt,
    canonicalFor: data.canonicalFor,
    supersedes: Array.isArray(data.supersedes) ? data.supersedes : [],
    supersededBy: data.supersededBy,
    relations: Array.isArray(data.relations) ? data.relations : [],
  };
}
