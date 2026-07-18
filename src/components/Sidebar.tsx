import { useState, useEffect } from 'react';
import type { WikiDocument } from '../lib/types';
import { getDisplayTitle } from '../lib/types';

export const WIKI_SIDEBAR_ID = 'wiki-sidebar';

const MOBILE_VIEWPORT_QUERY = '(max-width: 720px)';

type CategoryGroup = {
  readonly category: string;
  readonly documents: readonly WikiDocument[];
};

type SidebarProps = {
  readonly groups: readonly CategoryGroup[];
  readonly activeSlug: string;
  readonly onSelect: (slug: string) => void;
  readonly mobileOpen?: boolean;
  readonly onClose?: () => void;
};

export function Sidebar({ groups, activeSlug, onSelect, mobileOpen = true, onClose }: SidebarProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((group) => {
      const hasActive = group.documents.some((doc) => doc.slug === activeSlug);
      initial[group.category] = !hasActive;
    });
    return initial;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const updateViewport = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    groups.forEach((group) => {
      const hasActive = group.documents.some((doc) => doc.slug === activeSlug);
      if (hasActive) {
        setCollapsedGroups((prev) => ({
          ...prev,
          [group.category]: false,
        }));
      }
    });
  }, [activeSlug, groups]);

  const toggleGroup = (category: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSelect = (slug: string) => {
    onSelect(slug);
    if (onClose) onClose();
  };

  const mobileDrawerHidden = isMobileViewport && !mobileOpen;

  return (
    <aside
      id={WIKI_SIDEBAR_ID}
      className={"sidebar" + (mobileOpen === false ? " sidebar-closed" : "")}
      aria-label="Wiki navigation"
      aria-hidden={mobileDrawerHidden}
      inert={mobileDrawerHidden ? true : undefined}
    >
      {/* Navigation (no brand per spec) */}
      <div className="sidebarNav">
        <nav aria-label="Document categories">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups[group.category] ?? true;
            return (
              <section className="navGroup" key={group.category}>
                <button
                  className="navGroupHeader"
                  onClick={() => toggleGroup(group.category)}
                  aria-expanded={!isCollapsed}
                  type="button"
                >
                  <span className="folderIcon">{isCollapsed ? '📁' : '📂'}</span>
                  <span className="categoryTitle">{group.category}</span>
                  <span className="arrowIcon">{isCollapsed ? '▶' : '▼'}</span>
                </button>
                
                {!isCollapsed && (
                  <div className="navGroupItems">
                    {group.documents.map((document) => (
                      <button
                        className={document.slug === activeSlug ? 'navItem active' : 'navItem'}
                        key={document.slug}
                        onClick={() => handleSelect(document.slug)}
                        type="button"
                        aria-current={document.slug === activeSlug ? 'page' : undefined}
                      >
                        <span className="docIcon">📄</span>
                        <span className="docTitle">{getDisplayTitle(document)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
