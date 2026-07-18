/**
 * Strip a UTF-8 BOM and whitespace that precedes the opening frontmatter delimiter.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeWikiRaw(raw) {
  return raw.replace(/^\uFEFF/, '').replace(/^\s+/, '');
}

/**
 * Split a wiki document into its frontmatter block and markdown body.
 * A closing delimiter is required; the body may be empty.
 * @param {string} raw
 * @returns {{ frontmatter: string, body: string } | null}
 */
export function splitWikiFrontmatter(raw) {
  const normalized = normalizeWikiRaw(raw);
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/.exec(normalized);
  if (!match) {
    return null;
  }

  return { frontmatter: match[1] ?? '', body: match[2] ?? '' };
}

/**
 * Remove repeatedly nested matching outer quotes from a scalar value.
 * @param {string} value
 * @returns {string}
 */
export function stripWikiFrontmatterQuotes(value) {
  let normalized = value.trim();
  while (
    normalized.length >= 2
    && ((normalized.startsWith('"') && normalized.endsWith('"'))
      || (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

/**
 * Parse the scalar and bracketed-comma list forms used by wiki frontmatter.
 * @param {string} value
 * @returns {string[]}
 */
export function parseWikiFrontmatterList(value) {
  if (/^\s*-\s+/m.test(value)) {
    return value
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*-\s*/, ''))
      .map((item) => stripWikiFrontmatterQuotes(item))
      .filter(Boolean);
  }

  if (!value.startsWith('[') || !value.endsWith(']')) {
    return value ? [stripWikiFrontmatterQuotes(value)] : [];
  }

  return value
    .slice(1, -1)
    .split(',')
    .map((item) => stripWikiFrontmatterQuotes(item))
    .filter(Boolean);
}

/**
 * Parse the simple `key: value` lines used by wiki frontmatter.
 * @param {string} block
 * @returns {Map<string, string | null>}
 */
export function parseWikiFrontmatterFields(block) {
  const values = new Map();
  let blockListKey;
  for (const line of block.split(/\r?\n/)) {
    const blockListItem = /^\s+-\s*(.*)$/.exec(line);
    if (blockListKey && blockListItem) {
      const item = blockListItem[1] ?? '';
      const current = values.get(blockListKey);
      values.set(blockListKey, `${typeof current === 'string' && current ? `${current}\n` : ''}- ${item}`);
      continue;
    }

    const separator = line.indexOf(':');
    if (separator < 0) {
      blockListKey = undefined;
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) {
      blockListKey = undefined;
      continue;
    }
    if (value === 'null' || value === '~') {
      values.set(key, null);
      blockListKey = undefined;
      continue;
    }
    values.set(key, value);
    blockListKey = value ? undefined : key;
  }
  return values;
}

/**
 * Extract the optional wiki visibility marker without making visibility policy
 * part of the generic frontmatter parser.
 * @param {Map<string, string | null>} fields
 * @returns {string | undefined}
 */
export function extractWikiVisibility(fields) {
  return fields.get('wikiVisibility') ?? fields.get('visibility') ?? undefined;
}
