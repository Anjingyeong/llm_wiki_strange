/**
 * Pure markdown block parser for LLM Wiki (no React).
 * Hard breaks: trailing two spaces or trailing backslash.
 * Soft breaks: join with a single space.
 */

/**
 * @typedef {{ text: string, hardBreak: boolean }} ParagraphLine
 * @typedef {|
 *   { kind: 'heading', level: number, text: string } |
 *   { kind: 'paragraph', lines: ParagraphLine[] } |
 *   { kind: 'list', items: string[] } |
 *   { kind: 'code', language: string, code: string } |
 *   { kind: 'table', rows: string[][] } |
 *   { kind: 'quote', lines: string[] }
 * } MarkdownBlock
 */

/**
 * @param {string} raw
 * @returns {ParagraphLine}
 */
export function parseParagraphLine(raw) {
  if (raw.endsWith('\\')) {
    return { text: raw.slice(0, -1).replace(/\s+$/u, ''), hardBreak: true };
  }
  if (/ {2}$/u.test(raw)) {
    return { text: raw.replace(/ {2}$/u, ''), hardBreak: true };
  }
  return { text: raw.replace(/\s+$/u, ''), hardBreak: false };
}

/**
 * @param {string} value
 */
export function normalizeTitleForCompare(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”"‘’'`]/gu, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Skip body H1 when it duplicates document title or display title.
 * @param {string} headingText
 * @param {string} [documentTitle]
 * @param {string} [displayTitle]
 */
export function isDuplicateDocumentH1(headingText, documentTitle = '', displayTitle = '') {
  const n = normalizeTitleForCompare(headingText);
  if (!n) return false;
  const titles = [documentTitle, displayTitle]
    .map((t) => normalizeTitleForCompare(t))
    .filter(Boolean);
  return titles.some((t) => t === n);
}

/**
 * @param {string} markdown
 * @returns {MarkdownBlock[]}
 */
export function parseMarkdownBlocks(markdown) {
  /** @type {MarkdownBlock[]} */
  const blocks = [];
  const lines = String(markdown ?? '').split(/\r?\n/u);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'code', language, code: codeLines.join('\n') });
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }
    if (line.startsWith('|')) {
      /** @type {string[][]} */
      const rows = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('|')) {
        const cells = (lines[index] ?? '')
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/u.test(cell))) {
          rows.push(cells);
        }
        index += 1;
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }
    if (/^[-*]\s+/u.test(line)) {
      /** @type {string[]} */
      const items = [];
      while (index < lines.length && /^[-*]\s+/u.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*]\s+/u, ''));
        index += 1;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }
    if (line.startsWith('>')) {
      /** @type {string[]} */
      const quoteLines = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('>')) {
        quoteLines.push((lines[index] ?? '').replace(/^>\s?/u, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', lines: quoteLines });
      continue;
    }
    /** @type {ParagraphLine[]} */
    const paragraphLines = [];
    while (index < lines.length && (lines[index] ?? '').trim()) {
      const current = lines[index] ?? '';
      if (
        current.startsWith('```')
        || current.startsWith('|')
        || current.startsWith('>')
        || /^(#{1,3}|[-*])\s+/u.test(current)
      ) {
        break;
      }
      paragraphLines.push(parseParagraphLine(current));
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push({ kind: 'paragraph', lines: paragraphLines });
    }
  }

  return blocks;
}

/**
 * Flatten paragraph lines for plain-text consumers (search, tests).
 * Hard breaks become newlines; soft breaks become spaces.
 * @param {ParagraphLine[]} lines
 */
export function flattenParagraphLines(lines) {
  let out = '';
  for (let i = 0; i < lines.length; i += 1) {
    out += lines[i]?.text ?? '';
    if (i < lines.length - 1) {
      out += lines[i]?.hardBreak ? '\n' : ' ';
    }
  }
  return out;
}
