import { useState, useEffect } from 'react';
import type { WikiTaskNavigationGroup } from '../lib/types';
import { getDisplayTitle } from '../lib/types';
import { WikiNavIcon } from './WikiNavIcon';

export const WIKI_SIDEBAR_ID = 'wiki-sidebar';

const MOBILE_VIEWPORT_QUERY = '(max-width: 720px)';

type SidebarProps = {
  readonly groups: readonly WikiTaskNavigationGroup[];
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
      initial[group.id] = !hasActive;
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
          [group.id]: false,
        }));
      }
    });
  }, [activeSlug, groups]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
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
        <nav aria-label="Browse wiki by task">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups[group.id] ?? true;
            const itemsId = `wiki-task-${group.id}`;
            return (
              <section className="navGroup" key={group.id}>
                <button
                  className="navGroupHeader"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!isCollapsed}
                  aria-controls={itemsId}
                  type="button"
                >
                  <span className="folderIcon"><WikiNavIcon name="task" /></span>
                  <span className="categoryTitle">{group.label}</span>
                  <span className="arrowIcon"><WikiNavIcon name="chevron" expanded={!isCollapsed} /></span>
                </button>
                
                {!isCollapsed && (
                  <div className="navGroupItems" id={itemsId}>
                    {group.documents.map((document) => (
                      <button
                        className={document.slug === activeSlug ? 'navItem active' : 'navItem'}
                        key={document.slug}
                        onClick={() => handleSelect(document.slug)}
                        type="button"
                        aria-current={document.slug === activeSlug ? 'page' : undefined}
                      >
                        <span className="docIcon"><WikiNavIcon name="document" /></span>
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
