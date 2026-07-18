/**
 * Pure markdown block parser for LLM Wiki (no React).
 * Hard breaks: trailing two spaces or trailing backslash.
 * Soft breaks: join with a single space.
 */

export { resolveWikiMarkdownHref } from './wikiMarkdownLinks.mjs';

/**
 * @typedef {{ text: string, hardBreak: boolean }} ParagraphLine
 * @typedef {|
 *   { kind: 'heading', level: number, text: string } |
 *   { kind: 'paragraph', lines: ParagraphLine[] } |
 *   { kind: 'list', items: string[] } |
 *   { kind: 'code', language: string, code: string } |
 *   { kind: 'table', rows: string[][], alignments: (null | 'left' | 'center' | 'right')[] } |
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
 * @param {string} line
 * @param {number} index
 */
function isEscapedPipe(line, index) {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && line[i] === '\\'; i -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

/**
 * Split a pipe-table line while preserving escaped literal pipes.
 * @param {string} line
 * @returns {string[] | null}
 */
function parseTableRow(line) {
  if (!line.startsWith('|') || !line.endsWith('|') || isEscapedPipe(line, line.length - 1)) return null;
  /** @type {string[]} */
  const cells = [];
  let cell = '';
  for (let i = 1; i < line.length - 1; i += 1) {
    const char = line[i] ?? '';
    if (char === '|' && isEscapedPipe(line, i)) {
      cell = `${cell.slice(0, -1)}|`;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * @param {string[]} cells
 * @returns {(null | 'left' | 'center' | 'right')[] | null}
 */
function parseTableAlignments(cells) {
  /** @type {(null | 'left' | 'center' | 'right')[]} */
  const alignments = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/u.test(cell)) return null;
    if (cell.startsWith(':') && cell.endsWith(':')) {
      alignments.push('center');
    } else {
      alignments.push(cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : null);
    }
  }
  return alignments;
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
      const tableLines = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('|')) {
        tableLines.push(lines[index] ?? '');
        index += 1;
      }
      const parsedRows = tableLines.map(parseTableRow);
      const header = parsedRows[0];
      const separator = parsedRows[1];
      const alignments = separator ? parseTableAlignments(separator) : null;
      const width = header?.length ?? 0;
      const valid = Boolean(
        header
        && separator
        && alignments
        && width > 0
        && header.every((cell) => cell.trim().length > 0)
        && parsedRows.every((row) => row?.length === width)
        && alignments.length === width,
      );

      if (!valid) {
        blocks.push({ kind: 'code', language: 'text', code: tableLines.join('\n') });
        continue;
      }

      blocks.push({
        kind: 'table',
        rows: /** @type {string[][]} */ ([header, ...parsedRows.slice(2)]),
        alignments,
      });
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
