import { useEffect, useMemo, useRef, useState } from 'react';
import type { Heading } from '../lib/types';
import { selectTocHeadingId } from '../lib/tocSelection.mjs';
import { wikiLink } from '../lib/wikiHash';

type TableOfContentsProps = {
  readonly headings: readonly Heading[];
  readonly documentSlug: string;
};

export function TableOfContents({ headings, documentSlug }: TableOfContentsProps) {
  const headingIds = useMemo(() => headings.map((heading) => heading.id), [headings]);
  const headingSignature = headingIds.join('\u001f');
  const [activeId, setActiveId] = useState<string | null>(() => headingIds[0] ?? null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveId(headingIds[0] ?? null);
    if (!headingIds.length) return;

    const updateActiveHeading = () => {
      frameRef.current = null;
      const positions = headingIds
        .map((id) => {
          const element = document.getElementById(id);
          return element ? { id, top: element.getBoundingClientRect().top } : null;
        })
        .filter((position): position is { id: string; top: number } => position !== null);
      setActiveId(selectTocHeadingId(positions));
    };
    const scheduleUpdate = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(updateActiveHeading);
      }
    };

    const observer = new IntersectionObserver(scheduleUpdate, {
      root: null,
      rootMargin: '-96px 0px -60% 0px',
      threshold: 0,
    });
    headingIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [documentSlug, headingIds, headingSignature]);

  if (!headings.length) {
    return null;
  }

  return (
    <aside className="toc" aria-label="Table of contents">
      <strong>On this page</strong>
      {headings.map((heading) => (
        <a
          aria-current={heading.id === activeId ? 'location' : undefined}
          className={`level${heading.level}`}
          href={wikiLink(documentSlug, heading.id)}
          key={heading.id}
        >
          {heading.text}
        </a>
      ))}
    </aside>
  );
}
