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
          {groups.map((group) => (
            <section className="navGroup" key={group.category}>
              <h2>{group.category}</h2>
              {group.documents.map((document) => (
                <button
                  className={document.slug === activeSlug ? 'navItem active' : 'navItem'}
                  key={document.slug}
                  onClick={() => onSelect(document.slug)}
                  type="button"
                  aria-current={document.slug === activeSlug ? 'page' : undefined}
                >
                  {getDisplayTitle(document)}
                </button>
              ))}
            </section>
          ))}
        </nav>
      </div>
    </aside>
  );
}
