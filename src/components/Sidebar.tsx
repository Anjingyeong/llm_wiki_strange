import { useState, useEffect } from 'react';
import type { WikiDocument } from '../lib/types';
import { getDisplayTitle } from '../lib/types';

type CategoryGroup = {
  readonly category: string;
  readonly documents: readonly WikiDocument[];
};

type SidebarProps = {
  readonly groups: readonly CategoryGroup[];
  readonly activeSlug: string;
  readonly onSelect: (slug: string) => void;
};

export function Sidebar({ groups, activeSlug, onSelect }: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((group) => {
      const hasActive = group.documents.some((doc) => doc.slug === activeSlug);
      initial[group.category] = !hasActive;
    });
    return initial;
  });

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

  return (
    <aside className="sidebar" aria-label="Wiki navigation">
      {/* Brand / Logo */}
      <div className="brand">
        <span className="brandMark" aria-hidden="true">SS</span>
        <div className="brandText">
          <strong>LLM Wiki</strong>
          <small>Evidence&nbsp;·&nbsp;Portfolio&nbsp;·&nbsp;AI</small>
          <span className="brandStatus">
            <span className="brandStatusDot" />
            Live
          </span>
        </div>
      </div>

      {/* Navigation */}
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
                        onClick={() => onSelect(document.slug)}
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
