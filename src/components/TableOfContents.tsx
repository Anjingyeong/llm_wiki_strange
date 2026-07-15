import type { Heading } from '../lib/types';
import { wikiLink } from '../lib/wikiHash';

type TableOfContentsProps = {
  readonly headings: readonly Heading[];
  readonly documentSlug: string;
};

export function TableOfContents({ headings, documentSlug }: TableOfContentsProps) {
  if (!headings.length) {
    return null;
  }

  return (
    <aside className="toc" aria-label="Table of contents">
      <strong>On this page</strong>
      {headings.map((heading) => (
        <a className={`level${heading.level}`} href={wikiLink(documentSlug, heading.id)} key={`${heading.id}-${heading.text}`}>
          {heading.text}
        </a>
      ))}
    </aside>
  );
}
