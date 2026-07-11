import { useMemo, useState } from 'react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { RagPanel } from './components/RagPanel';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { TableOfContents } from './components/TableOfContents';
import { documentsByCategory, documentsBySlug, getInitialDocument } from './lib/documents';
import { isExcerptDuplicate } from './lib/frontmatter';
import { getDisplayTitle } from './lib/types';

function slugFromHash(): string {
  return window.location.hash.replace(/^#\/?/, '').split('#')[0] ?? '';
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('wiki_access_key');
  });
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const initial = getInitialDocument();
  const [activeSlug, setActiveSlug] = useState(() => slugFromHash() || initial.slug);
  const [query, setQuery] = useState('');
  const activeDocument = useMemo(
    () => documentsBySlug.get(activeSlug),
    [activeSlug],
  );

  const selectDocument = (slug: string, sectionId?: string | null) => {
    setActiveSlug(slug);
    setQuery('');
    window.location.hash = slug;
    // Jump to matched section when search provides a heading id (H2/H3).
    requestAnimationFrame(() => {
      if (sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setAuthError('접근 키를 입력해 주세요.');
      triggerShake();
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: keyInput }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        sessionStorage.setItem('wiki_access_key', keyInput);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.message || '인증에 실패했습니다.');
        triggerShake();
      }
    } catch (err) {
      setAuthError('서버 통신 중 오류가 발생했습니다.');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  if (!isAuthenticated) {
    return (
      <div className="lockScreenContainer">
        <div className={`lockCard ${shake ? 'shake' : ''}`}>
          <div className="lockIcon">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>Smart Safety LLM Wiki</h2>
          <p className="lockSubtitle">시스템 내부 문서 조회 및 RAG 서비스를 이용하시려면 접근 키를 입력해 주세요.</p>
          <form onSubmit={handleAuthSubmit}>
            <div className="inputGroup">
              <input
                type="password"
                placeholder="Access Key 입력"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            {authError && <p className="errorMessage">{authError}</p>}
            <button type="submit" className="submitBtn" disabled={isSubmitting}>
              {isSubmitting ? '인증 중...' : '접근하기'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
        <RagPanel />
        <article className="docCard">
          <header className="docHeader">
            <span>{activeDocument.category}</span>
            <h1>{getDisplayTitle(activeDocument)}</h1>
            {getDisplayTitle(activeDocument) !== activeDocument.title ? (
              <p className="formalTitle">정식 제목: {activeDocument.title}</p>
            ) : null}
            {!isExcerptDuplicate(activeDocument.body, activeDocument.excerpt) && (
              <p>{activeDocument.excerpt}</p>
            )}
            <div className="tagRow">
              {activeDocument.tags.map((tag) => (
                <small key={tag}>{tag}</small>
              ))}
            </div>
          </header>
          <MarkdownRenderer
            markdown={activeDocument.body}
            documentTitle={activeDocument.title}
            displayTitle={getDisplayTitle(activeDocument)}
          />
        </article>
      </main>
      <TableOfContents headings={activeDocument.headings} />
    </div>
  );
}
