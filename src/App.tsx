import { useEffect, useMemo, useState } from 'react';
import { DocumentArticle } from './components/DocumentArticle';
import { Sidebar, WIKI_SIDEBAR_ID } from './components/Sidebar';
import { StatusHeader } from './components/StatusHeader';
import { TableOfContents } from './components/TableOfContents';
import { WikiAskWorkspace } from './components/WikiAskWorkspace';
import { WikiCommandBar } from './components/WikiCommandBar';
import { WikiSearchWorkspace } from './components/WikiSearchWorkspace';
import { AccessGate } from './components/AccessGate';
import { documentsBySlug, documentsByTask, getInitialDocument } from './lib/documents';
import { scrollTopForTocAnchor } from './lib/tocSelection.mjs';
import { parseLocationHash, writeDocumentHash, writeViewHash, type WikiView } from './lib/wikiHash';
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

  const openWorkspace = (view: Exclude<WikiView, 'doc'>) => {
    setContentView(view);
    writeViewHash(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const returnToDocument = () => selectDocument(activeSlug);

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
        <main className="content" id="wiki-main-content">
          {contentView === 'doc' && activeDocument ? (
            <>
              <WikiCommandBar onOpenAsk={() => openWorkspace('rag')} onOpenSearch={() => openWorkspace('search')} />
              <DocumentArticle document={activeDocument} onSelectDocument={selectDocument} />
            </>
          ) : null}
          {contentView === 'search' ? (
            <WikiSearchWorkspace onReturnToDocument={returnToDocument} onSelectDocument={selectDocument} />
          ) : null}
          {contentView === 'rag' ? (
            <WikiAskWorkspace
              onAuthRequired={() => { clearWikiAccessKey(); setAuthed(false); }}
              onReturnToDocument={returnToDocument}
              onSelectDocument={selectDocument}
            />
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
