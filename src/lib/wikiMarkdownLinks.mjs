/**
 * @typedef {
 *   | { kind: 'text', value: string }
 *   | { kind: 'code', value: string }
 *   | { kind: 'strong', children: InlineMarkdownToken[] }
 *   | { kind: 'wiki-link', href: string, label: string }
 * } InlineMarkdownToken
 */

const INLINE_TOKEN_PATTERN = /(`[^`\r\n]+`|\*\*[^*\r\n]+\*\*|\[([^\]\r\n]+)\]\(([^()\s]+)\))/gu;

/** @param {InlineMarkdownToken[]} tokens @param {string} value */
function appendText(tokens, value) {
  if (!value) return;
  const previous = tokens.at(-1);
  if (previous?.kind === 'text') {
    previous.value += value;
  } else {
    tokens.push({ kind: 'text', value });
  }
}

/**
 * Convert a same-directory Markdown document href to the wiki SPA route.
 * All other hrefs remain outside this resolver's boundary.
 * @param {string} href
 * @returns {string | null}
 */
export function resolveWikiMarkdownHref(href) {
  if (
    typeof href !== 'string'
    || href !== href.trim()
    || /[\u0000-\u001f\u007f\s]/u.test(href)
    || /^[a-z][a-z\d+.-]*:/iu.test(href)
  ) {
    return null;
  }

  const match = /^(?:\.\/)?([^./\\?#][^/\\?#]*)\.md(?:#([^#]+))?$/u.exec(href);
  const slug = match?.[1];
  if (!slug || slug === '.' || slug === '..') return null;

  try {
    const route = `#/${encodeURIComponent(slug)}`;
    const section = match?.[2];
    return section ? `${route}/${encodeURIComponent(section)}` : route;
  } catch {
    return null;
  }
}

/**
 * Parse only the inline constructs the wiki renderer supports.
 * Unsupported or unsafe Markdown links remain literal text.
 * @param {string} text
 * @returns {InlineMarkdownToken[]}
 */
export function parseWikiInlineMarkdown(text) {
  /** @type {InlineMarkdownToken[]} */
  const tokens = [];
  let cursor = 0;

  for (const match of String(text ?? '').matchAll(INLINE_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) appendText(tokens, text.slice(cursor, index));

    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push({ kind: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('**')) {
      tokens.push({ kind: 'strong', children: parseWikiInlineMarkdown(raw.slice(2, -2)) });
    } else {
      const href = resolveWikiMarkdownHref(match[3] ?? '');
      if (href) {
        tokens.push({ kind: 'wiki-link', href, label: match[2] ?? '' });
      } else {
        appendText(tokens, raw);
      }
    }
    cursor = index + raw.length;
  }

  if (cursor < text.length) appendText(tokens, text.slice(cursor));
  return tokens;
}
