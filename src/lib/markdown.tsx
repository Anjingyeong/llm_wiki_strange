import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { slugify } from './frontmatter';
import {
  flattenParagraphLines,
  isDuplicateDocumentH1,
  normalizeTitleForCompare,
  parseMarkdownBlocks as parseBlocksCore,
  parseParagraphLine,
} from './markdownParse.mjs';

export {
  flattenParagraphLines,
  isDuplicateDocumentH1,
  normalizeTitleForCompare,
  parseParagraphLine,
};
export const parseMarkdownBlocks = parseBlocksCore;

type ParagraphLine = { readonly text: string; readonly hardBreak: boolean };

export function inlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${index}-${part.slice(0, 12)}`}>{part}</Fragment>;
  });
}

export function renderParagraphLines(lines: readonly ParagraphLine[]): ReactNode {
  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    nodes.push(
      <Fragment key={`t-${i}`}>{inlineMarkdown(line.text)}</Fragment>,
    );
    if (i < lines.length - 1) {
      if (line.hardBreak) {
        nodes.push(<br key={`br-${i}`} />);
      } else {
        nodes.push(' ');
      }
    }
  });
  return nodes;
}

export function headingId(text: string): string {
  return slugify(text);
}

export function paragraphPlainText(block: {
  text?: string;
  lines?: readonly ParagraphLine[];
}): string {
  if (block.lines) {
    return flattenParagraphLines([...block.lines]);
  }
  return block.text ?? '';
}

export type { ParagraphLine };
