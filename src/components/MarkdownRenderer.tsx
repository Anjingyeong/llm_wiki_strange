import { inlineMarkdown, isDuplicateDocumentH1, parseMarkdownBlocks, renderParagraphLines } from '../lib/markdown';
import { wikiLink } from '../lib/wikiHash';
import { MermaidDiagram } from './MermaidDiagram';
import { allocateHeadingIds } from '../lib/wikiHeadings.mjs';

type MarkdownRendererProps = {
  readonly markdown: string;
  /** Formal document title (frontmatter title) for H1 de-dupe */
  readonly documentTitle?: string;
  /** Display title shown in docHeader (navTitle etc.) */
  readonly displayTitle?: string;
  readonly documentSlug?: string;
};

function codeLanguageClass(language: string): string {
  const normalized = language.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return normalized ? `language-${normalized}` : 'language-text';
}

export function MarkdownRenderer({
  markdown,
  documentTitle = '',
  displayTitle = '',
  documentSlug = '',
}: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(markdown);
  const headingIds = allocateHeadingIds(
    blocks
      .filter((block): block is Extract<(typeof blocks)[number], { kind: 'heading' }> => block.kind === 'heading')
      .map((block) => ({ text: block.text, level: block.level })),
  );
  let headingIndex = 0;
  let skippedDuplicateH1 = false;

  return (
    <div className="markdown">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const id = headingIds[headingIndex++]?.id ?? `section-${index}`;
            // Only the first body H1 that duplicates the page title is suppressed.
            if (
              block.level === 1
              && !skippedDuplicateH1
              && isDuplicateDocumentH1(block.text, documentTitle, displayTitle)
            ) {
              skippedDuplicateH1 = true;
              return null;
            }
            if (block.level === 1) {
              return <h1 key={`${id}-${index}`}>{inlineMarkdown(block.text)}</h1>;
            }
            if (block.level === 2) {
              return (
                <h2 id={id} key={`${id}-${index}`}>
                  {inlineMarkdown(block.text)}{' '}
                  <a
                    aria-label={`${block.text} 섹션 링크`}
                    className="headingPermalink"
                    href={documentSlug ? wikiLink(documentSlug, id) : `#${id}`}
                  >
                    #
                  </a>
                </h2>
              );
            }
            return (
              <h3 id={id} key={`${id}-${index}`}>
                {inlineMarkdown(block.text)}{' '}
                <a
                  aria-label={`${block.text} 섹션 링크`}
                  className="headingPermalink"
                  href={documentSlug ? wikiLink(documentSlug, id) : `#${id}`}
                >
                  #
                </a>
              </h3>
            );
          }
          case 'paragraph':
            return (
              <p key={`p-${index}`}>{renderParagraphLines(block.lines)}</p>
            );
          case 'list':
            return (
              <ul key={`list-${index}`}>
                {block.items.map((item) => (
                  <li key={item}>{inlineMarkdown(item)}</li>
                ))}
              </ul>
            );
          case 'quote': {
            const lines = 'lines' in block && Array.isArray(block.lines)
              ? block.lines
              : [(block as { text?: string }).text ?? ''];
            return (
              <blockquote key={`q-${index}`} className="decisionQuote">
                {lines.map((line, i) => (
                  <p key={`ql-${i}`}>{inlineMarkdown(line || '\u00a0')}</p>
                ))}
              </blockquote>
            );
          }
          case 'table': {
            const firstRow = block.rows[0] ?? [];
            const bodyRows = block.rows.slice(1);
            return (
              <div className="tableWrap" key={`table-${index}`}>
                <table>
                  <thead>
                    <tr>
                      {firstRow.map((cell, columnIndex) => (
                        <th
                          key={`table-${index}-header-${columnIndex}`}
                          scope="col"
                          style={{ textAlign: block.alignments[columnIndex] ?? undefined }}
                        >
                          {inlineMarkdown(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyRows.map((row, rowIndex) => (
                      <tr key={`table-${index}-row-${rowIndex}`}>
                        {row.map((cell, columnIndex) => (
                          <td
                            key={`table-${index}-row-${rowIndex}-cell-${columnIndex}`}
                            style={{ textAlign: block.alignments[columnIndex] ?? undefined }}
                          >
                            {inlineMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'code':
            if (block.language.trim().toLowerCase() === 'mermaid') {
              return <MermaidDiagram chart={block.code} diagramId={`diagram-${index}`} key={`mermaid-${index}`} />;
            }
            return (
              <figure className={block.language === 'mermaid' ? 'codeBlock mermaidBlock' : 'codeBlock'} key={`code-${index}`}>
                <figcaption>{block.language || 'text'}</figcaption>
                <pre>
                  <code className={codeLanguageClass(block.language)}>{block.code}</code>
                </pre>
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
