import { useEffect, useMemo, useState } from 'react';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { Sidebar, WIKI_SIDEBAR_ID } from './components/Sidebar';
import { StatusHeader } from './components/StatusHeader';
import { TableOfContents } from './components/TableOfContents';
import { WikiToolsPanel } from './components/WikiToolsPanel';
import { AccessGate } from './components/AccessGate';
import { documentsBySlug, documentsByTask, getInitialDocument } from './lib/documents';
import { isExcerptDuplicate } from './lib/frontmatter';
import { getDisplayTitle } from './lib/types';
import { scrollTopForTocAnchor } from './lib/tocSelection.mjs';
import { parseLocationHash, writeDocumentHash, type WikiView } from './lib/wikiHash';
import { clearWikiAccessKey, getWikiAccessKey, hasWikiAccessKey } from './lib/wikiAccessKey';
import { useMobileWikiNavigation } from './components/useMobileWikiNavigation';

export function App() {
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
  const { closeMobileNav, mobileMenuButtonRef, mobileNavOpen, openMobileNav } =
    useMobileWikiNavigation(WIKI_SIDEBAR_ID);

  // Access gate state
  const [accessKeyRequired, setAccessKeyRequired] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(() => hasWikiAccessKey());

  const activeDocument = useMemo(() => documentsBySlug.get(activeSlug), [activeSlug]);

  // Determine if gate is required
  useEffect(() => {
    let cancelled = false;
    fetch('/api/rag/config', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : { accessKeyRequired: false }))
      .then((data) => {
        if (cancelled) return;
        const req = !!(data && data.accessKeyRequired);
        setAccessKeyRequired(req);
        if (req && !hasWikiAccessKey()) {
          setAuthed(false);
        } else {
          setAuthed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccessKeyRequired(false);
          setAuthed(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pendingSectionId || !activeDocument) return;
    let cancelled = false;
    const tryScroll = (attempt: number) => {
      if (cancelled) return;
      const el = document.getElementById(pendingSectionId);
      if (el) {
        window.scrollTo({
          top: scrollTopForTocAnchor(el.getBoundingClientRect().top, window.scrollY),
          behavior: 'smooth',
        });
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

  const onAuthed = () => {
    setAuthed(true);
  };

  // Gate when required and no key
  if (accessKeyRequired && !authed) {
    return (
      <div className="appRoot">
        <AccessGate onAuthed={onAuthed} />
      </div>
    );
  }

  if (!activeDocument && contentView === 'doc') {
    return (
      <div className="appRoot">
        <a className="skipLink" href="#wiki-main-content">본문으로 건너뛰기</a>
        <StatusHeader
          menuButtonRef={mobileMenuButtonRef}
          menuOpen={mobileNavOpen}
          onMenuClick={openMobileNav}
          sidebarId={WIKI_SIDEBAR_ID}
        />
        <div className="appShell">
          <Sidebar activeSlug={activeSlug} groups={documentsByTask} onSelect={selectDocument} mobileOpen={mobileNavOpen} onClose={closeMobileNav} />
          <main className="notFound" id="wiki-main-content">
            <h1>문서를 찾을 수 없습니다</h1>
            <p>
              경로 <code>#{activeSlug}</code> 에 해당하는 문서가 없습니다. archived slug이거나 잘못된 링크일 수 있습니다.
            </p>
            <button onClick={() => selectDocument(initial.slug)} type="button">
              Overview로 이동
            </button>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="appRoot">
      <a className="skipLink" href="#wiki-main-content">본문으로 건너뛰기</a>
      <StatusHeader
        menuButtonRef={mobileMenuButtonRef}
        menuOpen={mobileNavOpen}
        onMenuClick={openMobileNav}
        sidebarId={WIKI_SIDEBAR_ID}
      />
      <div className="appShell">
        <Sidebar
          activeSlug={activeSlug}
          groups={documentsByTask}
          onSelect={selectDocument}
          mobileOpen={mobileNavOpen}
          onClose={closeMobileNav}
          aria-label="Wiki navigation"
        />
        <main className="content" id="wiki-main-content" role="main">
          <WikiToolsPanel initialTab={toolsTab} onSelectDocument={selectDocument} onAuthRequired={() => { clearWikiAccessKey(); setAuthed(false); }} />
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
        {mobileNavOpen && (
          <div className="sidebar-backdrop" onClick={closeMobileNav} aria-hidden="true" />
        )}
        {contentView === 'doc' && activeDocument ? (
          <TableOfContents documentSlug={activeDocument.slug} headings={activeDocument.headings} />
        ) : null}
      </div>
    </div>
  );
}
