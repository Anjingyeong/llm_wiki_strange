/**
 * Shared heading id rules — must match frontmatter slugify / MarkdownRenderer headingId.
 */

export function slugifyHeading(text) {
  const normalized = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'section';
}

/**
 * Extract H2/H3 from raw markdown body (after frontmatter stripped).
 * @param {string} body
 * @returns {{ id: string, text: string, level: 2|3, searchableText: string }[]}
 */
export function extractHeadingsFromBody(body) {
  const headings = [];
  for (const line of String(body ?? '').split(/\r?\n/)) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length === 2 ? 2 : 3;
    const text = match[2].trim();
    const id = slugifyHeading(text);
    headings.push({
      id,
      text,
      level,
      searchableText: text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  return headings;
}
