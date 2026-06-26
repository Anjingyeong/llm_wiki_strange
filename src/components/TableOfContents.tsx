import type { Heading } from '../lib/types';

type TableOfContentsProps = {
  readonly headings: readonly Heading[];
};

export function TableOfContents({ headings }: TableOfContentsProps) {
  if (!headings.length) {
    return null;
  }

  return (
    <aside className="toc" aria-label="Table of contents">
      <strong>On this page</strong>
      {headings.map((heading) => (
        <a className={`level${heading.level}`} href={`#${heading.id}`} key={`${heading.id}-${heading.text}`}>
          {heading.text}
        </a>
      ))}
    </aside>
  );
}
