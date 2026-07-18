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

function inlineTokenIdentity(token: InlineToken): string {
  switch (token.kind) {
    case 'code':
      return JSON.stringify(['code', token.value]);
    case 'strong':
      return JSON.stringify(['strong', token.children.map(inlineTokenIdentity)]);
    case 'wiki-link':
      return JSON.stringify(['wiki-link', token.href, token.label]);
    case 'text':
      return JSON.stringify(['text', token.value]);
    default:
      throw new TypeError('Unsupported inline token kind');
  }
}

function nextOccurrenceKey(identity: string, occurrences: Map<string, number>): string {
  const occurrence = (occurrences.get(identity) ?? 0) + 1;
  occurrences.set(identity, occurrence);
  return JSON.stringify([identity, occurrence]);
}

function renderInlineTokens(tokens: readonly InlineToken[]): ReactNode {
  const occurrences = new Map<string, number>();
  return tokens.map((token) => {
    const key = nextOccurrenceKey(inlineTokenIdentity(token), occurrences);
    switch (token.kind) {
      case 'code':
        return <code key={key}>{token.value}</code>;
      case 'strong':
        return <strong key={key}>{renderInlineTokens(token.children)}</strong>;
      case 'wiki-link':
        return <a href={token.href} key={key}>{inlineMarkdown(token.label)}</a>;
      case 'text':
        return <Fragment key={key}>{token.value}</Fragment>;
    }
  });
}

export function renderParagraphLines(lines: readonly ParagraphLine[]): ReactNode {
  const nodes: ReactNode[] = [];
  const occurrences = new Map<string, number>();
  let remainingLines = lines.length;
  lines.forEach((line) => {
    remainingLines -= 1;
    const key = nextOccurrenceKey(JSON.stringify([line.text, line.hardBreak]), occurrences);
    nodes.push(
      <Fragment key={`line-${key}`}>{inlineMarkdown(line.text)}</Fragment>,
    );
    if (remainingLines > 0) {
      if (line.hardBreak) {
        nodes.push(<br key={`break-${key}`} />);
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
