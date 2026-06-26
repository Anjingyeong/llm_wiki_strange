import type { WikiDocument } from '../lib/types';

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
      <div className="brand">
        <span className="brandMark">SS</span>
        <div>
          <strong>LLM Wiki</strong>
          <small>Smart Safety Monitoring</small>
        </div>
      </div>
      <nav>
        {groups.map((group) => (
          <section className="navGroup" key={group.category}>
            <h2>{group.category}</h2>
            {group.documents.map((document) => (
              <button
                className={document.slug === activeSlug ? 'navItem active' : 'navItem'}
                key={document.slug}
                onClick={() => onSelect(document.slug)}
                type="button"
              >
                {document.title}
              </button>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}
