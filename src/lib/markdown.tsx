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
import { parseWikiInlineMarkdown } from './wikiMarkdownLinks.mjs';

export {
  flattenParagraphLines,
  isDuplicateDocumentH1,
  normalizeTitleForCompare,
  parseParagraphLine,
};
export const parseMarkdownBlocks = parseBlocksCore;

type ParagraphLine = { readonly text: string; readonly hardBreak: boolean };

export function inlineMarkdown(text: string): ReactNode {
  return renderInlineTokens(parseWikiInlineMarkdown(text));
}

type InlineToken = ReturnType<typeof parseWikiInlineMarkdown>[number];

function renderInlineTokens(tokens: readonly InlineToken[]): ReactNode {
  return tokens.map((token, index) => {
    switch (token.kind) {
      case 'code':
        return <code key={`nested-code-${index}`}>{token.value}</code>;
      case 'strong':
        return <strong key={`nested-strong-${index}`}>{renderInlineTokens(token.children)}</strong>;
      case 'wiki-link':
        return <a href={token.href} key={`nested-link-${token.href}-${index}`}>{inlineMarkdown(token.label)}</a>;
      case 'text':
        return <Fragment key={`nested-text-${index}`}>{token.value}</Fragment>;
    }
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
