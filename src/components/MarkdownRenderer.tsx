import { headingId, inlineMarkdown, parseMarkdownBlocks } from '../lib/markdown';

type MarkdownRendererProps = {
  readonly markdown: string;
};

export function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(markdown);

  return (
    <div className="markdown">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const id = headingId(block.text);
            if (block.level === 1) {
              return <h1 key={`${id}-${index}`}>{inlineMarkdown(block.text)}</h1>;
            }
            if (block.level === 2) {
              return (
                <h2 id={id} key={`${id}-${index}`}>
                  <a href={`#${id}`}>{inlineMarkdown(block.text)}</a>
                </h2>
              );
            }
            return (
              <h3 id={id} key={`${id}-${index}`}>
                <a href={`#${id}`}>{inlineMarkdown(block.text)}</a>
              </h3>
            );
          }
          case 'paragraph':
            return <p key={`${block.text}-${index}`}>{inlineMarkdown(block.text)}</p>;
          case 'list':
            return (
              <ul key={`list-${index}`}>
                {block.items.map((item) => (
                  <li key={item}>{inlineMarkdown(item)}</li>
                ))}
              </ul>
            );
          case 'quote':
            return <blockquote key={`${block.text}-${index}`}>{inlineMarkdown(block.text)}</blockquote>;
          case 'table': {
            const firstRow = block.rows[0] ?? [];
            const bodyRows = block.rows.slice(1);
            return (
              <div className="tableWrap" key={`table-${index}`}>
                <table>
                  <thead>
                    <tr>
                      {firstRow.map((cell) => (
                        <th key={cell}>{inlineMarkdown(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyRows.map((row) => (
                      <tr key={row.join('|')}>
                        {row.map((cell) => (
                          <td key={cell}>{inlineMarkdown(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'code':
            return (
              <figure className={block.language === 'mermaid' ? 'codeBlock mermaidBlock' : 'codeBlock'} key={`code-${index}`}>
                <figcaption>{block.language || 'text'}</figcaption>
                <pre>
                  <code>{block.code}</code>
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
