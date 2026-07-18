import { wikiUxMeta } from '../generated/wikiUxMeta';

type WikiCommandBarProps = {
  readonly onOpenAsk: () => void;
  readonly onOpenSearch: () => void;
};

function CommandIcon({ kind }: { readonly kind: 'ask' | 'search' | 'status' }) {
  if (kind === 'search') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  }
  if (kind === 'ask') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M9 9h6M9 13h4" /></svg>;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="10" cy="18" r="1" /></svg>;
}

export function WikiCommandBar({ onOpenAsk, onOpenSearch }: WikiCommandBarProps) {
  const { rag, search } = wikiUxMeta;
  return (
    <nav aria-label="Wiki tools" className="wikiCommandBar">
      <button onClick={onOpenSearch} type="button"><CommandIcon kind="search" />Search</button>
      <button onClick={onOpenAsk} type="button"><CommandIcon kind="ask" />Ask</button>
      <details className="wikiSystemStatus">
        <summary><CommandIcon kind="status" />System status</summary>
        <dl>
          <div><dt>Search index</dt><dd>{search.documentCount} documents · {search.generatedAt.slice(0, 10)}</dd></div>
          <div><dt>RAG index</dt><dd>{rag.documentCount} documents · {rag.chunkCount} chunks · {rag.indexGeneratedAt.slice(0, 10)}</dd></div>
        </dl>
        <p>Build-time index facts only. Runtime service health is not inferred.</p>
      </details>
    </nav>
  );
}
