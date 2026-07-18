import { useMemo, useState } from 'react';
import { SEARCH_RESULT_LIMIT_MAX, searchDocuments } from '../lib/search';
import { getDisplayTitle } from '../lib/types';
import { wikiLink } from '../lib/wikiHash';

type WikiSearchWorkspaceProps = {
  readonly onReturnToDocument: () => void;
  readonly onSelectDocument: (slug: string, sectionId?: string | null) => void;
};

const PAGE_SIZE = 12;

function isUnmodifiedPrimaryClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

export function WikiSearchWorkspace({ onReturnToDocument, onSelectDocument }: WikiSearchWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const allResults = useMemo(
    () => searchDocuments(query, { limit: SEARCH_RESULT_LIMIT_MAX }),
    [query],
  );
  const results = allResults.slice(0, visible);
  const emptyState = query.trim()
    ? '일치하는 문서가 없습니다. 다른 용어나 코드 심볼을 시도해 보세요.'
    : '검색어를 입력하면 제목, 섹션, 태그, 본문 근거를 함께 찾습니다.';

  return (
    <section aria-labelledby="wiki-search-title" className="wikiWorkspace wikiSearchWorkspace">
      <header className="wikiWorkspaceHeader">
        <div><span className="workspaceEyebrow">Evidence discovery</span><h1 id="wiki-search-title">문서 검색</h1></div>
        <button className="workspaceBack" onClick={onReturnToDocument} type="button">문서로 돌아가기</button>
      </header>
      <label htmlFor="wiki-search">검색어</label>
      <input
        autoComplete="off"
        id="wiki-search"
        onChange={(event) => { setQuery(event.currentTarget.value); setVisible(PAGE_SIZE); }}
        placeholder="예: frameId, MQTT, 기준선"
        type="search"
        value={query}
      />
      <p aria-live="polite" className="searchMeta">
        {query.trim() ? `${allResults.length}건 중 ${results.length}건 표시` : '검색 준비됨'}
      </p>
      {results.length > 0 ? (
        <>
          <ul className="searchResultList">
            {results.map((result) => {
              const section = result.headings?.find(({ id }) => id === result.matchedSectionId)?.text;
              return (
                <li key={`${result.slug}-${result.matchedSectionId ?? ''}`}>
                  <a
                    href={wikiLink(result.slug, result.matchedSectionId)}
                    onClick={(event) => {
                      if (!isUnmodifiedPrimaryClick(event)) return;
                      event.preventDefault();
                      onSelectDocument(result.slug, result.matchedSectionId);
                    }}
                  >
                    <span className="searchResultContext">{result.category}{result.type ? ` · ${result.type}` : ''}</span>
                    <strong>{getDisplayTitle(result)}</strong>
                    {section ? <span className="searchResultSection">Matched section: {section}</span> : null}
                    <span className="searchResultEvidence">{result.status ?? 'state unknown'} · {result.evidenceLevel ?? 'evidence not recorded'}</span>
                    <span className="searchResultExcerpt">{(result.snippet ?? result.excerpt).slice(0, 180)}</span>
                    {result.matchReasons?.length ? <span className="searchResultReason">Match: {result.matchReasons.slice(0, 3).join(' · ')}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
          {allResults.length > visible ? (
            <button className="searchMoreBtn" onClick={() => setVisible((count) => count + PAGE_SIZE)} type="button">
              더 보기 ({visible}/{allResults.length})
            </button>
          ) : null}
        </>
      ) : <p className="emptyState">{emptyState}</p>}
    </section>
  );
}
