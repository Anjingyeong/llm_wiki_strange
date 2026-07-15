import { useEffect, useMemo, useState } from 'react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { Sidebar } from './components/Sidebar';
import { TableOfContents } from './components/TableOfContents';
import { WikiToolsPanel } from './components/WikiToolsPanel';
import { documentsByCategory, documentsBySlug, getInitialDocument } from './lib/documents';
import { isExcerptDuplicate } from './lib/frontmatter';
import { getDisplayTitle } from './lib/types';
import { parseLocationHash, writeDocumentHash, type WikiView } from './lib/wikiHash';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('wiki_access_key');
  });
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const initial = getInitialDocument();
  const initialHash = parseLocationHash();
  const [contentView, setContentView] = useState<WikiView>(() => initialHash.view);
  const [activeSlug, setActiveSlug] = useState(() =>
    initialHash.view === 'doc' ? initialHash.slug || initial.slug : initial.slug,
  );
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(() =>
    initialHash.view === 'doc' ? initialHash.sectionId : null,
  );
  const [toolsTab, setToolsTab] = useState<'search' | 'ask' | 'system'>(() =>
    initialHash.view === 'rag' ? 'ask' : 'search',
  );

  const activeDocument = useMemo(() => documentsBySlug.get(activeSlug), [activeSlug]);

  useEffect(() => {
    if (!pendingSectionId || !activeDocument) return;
    let cancelled = false;
    const tryScroll = (attempt: number) => {
      if (cancelled) return;
      const el = document.getElementById(pendingSectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setPendingSectionId(null);
        return;
      }
      if (attempt < 12) {
        window.setTimeout(() => tryScroll(attempt + 1), 40);
      } else {
        setPendingSectionId(null);
      }
    };
    tryScroll(0);
    return () => {
      cancelled = true;
    };
  }, [activeDocument, pendingSectionId, activeSlug]);

  useEffect(() => {
    const onHash = () => {
      const parsed = parseLocationHash();
      setContentView(parsed.view);
      if (parsed.view === 'search') setToolsTab('search');
      if (parsed.view === 'rag') setToolsTab('ask');
      if (parsed.view === 'doc' && parsed.slug) {
        setActiveSlug(parsed.slug);
        setPendingSectionId(parsed.sectionId);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectDocument = (slug: string, sectionId?: string | null) => {
    setContentView('doc');
    setActiveSlug(slug);
    writeDocumentHash(slug, sectionId);
    if (sectionId) {
      setPendingSectionId(sectionId);
    } else {
      setPendingSectionId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
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
          <div className="lockBrand">
            <span className="brandMark" aria-hidden="true">SS</span>
            <strong>LLM Wiki</strong>
          </div>
          <h1>접근 키가 필요합니다</h1>
          <p>Wiki 및 RAG 질의는 접근 키 인증 후 이용할 수 있습니다.</p>
          <form onSubmit={handleAuthSubmit} className="lockForm">
            <label htmlFor="wiki-key">접근 키</label>
            <input
              id="wiki-key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="접근 키 입력"
              autoFocus
            />
            {authError && <p className="errorMessage">{authError}</p>}
            <button type="submit" className="submitBtn" disabled={isSubmitting}>
              {isSubmitting ? '인증 중...' : '접근하기'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!activeDocument && contentView === 'doc') {
    return (
      <div className="appShell">
        <Sidebar activeSlug={activeSlug} groups={documentsByCategory} onSelect={selectDocument} />
        <main className="notFound">
          <h1>문서를 찾을 수 없습니다</h1>
          <p>
            경로 <code>#{activeSlug}</code> 에 해당하는 문서가 없습니다. archived slug이거나 잘못된 링크일 수 있습니다.
          </p>
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
        <WikiToolsPanel initialTab={toolsTab} onSelectDocument={selectDocument} />
        {contentView === 'doc' && activeDocument ? (
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
                {(activeDocument.tags ?? []).map((tag) => (
                  <small key={tag}>{tag}</small>
                ))}
              </div>
            </header>
            <MarkdownRenderer
              markdown={activeDocument.body}
              documentTitle={activeDocument.title}
              displayTitle={getDisplayTitle(activeDocument)}
              documentSlug={activeDocument.slug}
            />
          </article>
        ) : null}
      </main>
      {contentView === 'doc' && activeDocument ? (
        <TableOfContents documentSlug={activeDocument.slug} headings={activeDocument.headings} />
      ) : null}
    </div>
  );
}