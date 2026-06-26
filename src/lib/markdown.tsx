import type { ReactNode } from 'react';
import { slugify } from './frontmatter';

type Block =
  | { readonly kind: 'heading'; readonly level: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'code'; readonly language: string; readonly code: string }
  | { readonly kind: 'table'; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: 'quote'; readonly text: string };

export function parseMarkdownBlocks(markdown: string): readonly Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'code', language, code: codeLines.join('\n') });
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('|')) {
        const cells = (lines[index] ?? '').split('|').slice(1, -1).map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
          rows.push(cells);
        }
        index += 1;
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }
    if (line.startsWith('>')) {
      blocks.push({ kind: 'quote', text: line.replace(/^>\s?/, '') });
      index += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index] ?? '').trim()) {
      const current = lines[index] ?? '';
      if (current.startsWith('```') || current.startsWith('|') || /^(#{1,3}|[-*])\s+/.test(current)) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

export function inlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function headingId(text: string): string {
  return slugify(text);
}
