import { useMemo, useState } from 'react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { TableOfContents } from './components/TableOfContents';
import { documentsByCategory, documentsBySlug, getInitialDocument } from './lib/documents';

function slugFromHash(): string {
  return window.location.hash.replace(/^#\/?/, '').split('#')[0] ?? '';
}

export function App() {
  const initial = getInitialDocument();
  const [activeSlug, setActiveSlug] = useState(() => slugFromHash() || initial.slug);
  const [query, setQuery] = useState('');
  const activeDocument = useMemo(
    () => documentsBySlug.get(activeSlug),
    [activeSlug],
  );

  const selectDocument = (slug: string) => {
    setActiveSlug(slug);
    setQuery('');
    window.location.hash = slug;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!activeDocument) {
    return (
      <div className="appShell">
        <Sidebar activeSlug={activeSlug} groups={documentsByCategory} onSelect={selectDocument} />
        <main className="notFound">
          <h1>문서를 찾을 수 없습니다</h1>
          <p>요청한 Wiki 경로가 존재하지 않습니다. 왼쪽 네비게이션이나 검색으로 문서를 다시 선택하세요.</p>
          <button onClick={() => selectDocument(initial.slug)} type="button">
            Overview로 이동
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="appShell">
      <Sidebar activeSlug={activeSlug} groups={documentsByCategory} onSelect={selectDocument} />
      <main className="content">
        <SearchPanel onQueryChange={setQuery} onSelect={selectDocument} query={query} />
        <article className="docCard">
          <header className="docHeader">
            <span>{activeDocument.category}</span>
            <h1>{activeDocument.title}</h1>
            <p>{activeDocument.excerpt}</p>
            <div className="tagRow">
              {activeDocument.tags.map((tag) => (
                <small key={tag}>{tag}</small>
              ))}
            </div>
          </header>
          <MarkdownRenderer markdown={activeDocument.body} />
        </article>
      </main>
      <TableOfContents headings={activeDocument.headings} />
    </div>
  );
}
