import { useMemo, useState } from 'react';
import { ExpandableText } from './ExpandableText';
import { SEARCH_RESULT_LIMIT_MAX, searchDocuments } from '../lib/search';
import { getDisplayTitle } from '../lib/types';

type SearchPanelProps = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onSelect: (slug: string, sectionId?: string | null) => void;
};

const PAGE_SIZE = 12;

export function SearchPanel({ query, onQueryChange, onSelect }: SearchPanelProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const allResults = useMemo(
    () => searchDocuments(query, { limit: SEARCH_RESULT_LIMIT_MAX }),
    [query],
  );
  const results = allResults.slice(0, visible);

  return (
    <section className="searchPanel" aria-label="Wiki search">
      <label htmlFor="wiki-search">문서 검색</label>
      <div className="searchInputWrap">
        <span className="searchIcon" aria-hidden="true">🔍</span>
        <input
          autoComplete="off"
          id="wiki-search"
          onChange={(event) => {
            onQueryChange(event.currentTarget.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="문서 제목, 코드 심볼, 태그, 본문 검색…"
          type="search"
          value={query}
        />
      </div>

      {query ? (
        <div className="searchResults" role="listbox" aria-label="검색 결과">
          <p className="searchMeta">
            {allResults.length
              ? `${allResults.length}건 중 ${results.length}건 표시 (최대 ${SEARCH_RESULT_LIMIT_MAX}건)`
              : '검색 결과 없음'}
          </p>
          {results.length ? (
            <>
              {results.map((result) => {
                const short = result.shortTitle || getDisplayTitle(result);
                const reasons = result.matchReasons?.length
                  ? result.matchReasons.join(' · ')
                  : null;
                const snip = result.snippet || result.excerpt || '';
                const tags = result.tags ?? [];
                return (
                  <button
                    className="searchResult"
                    key={result.slug}
                    onClick={() => onSelect(result.slug, result.matchedSectionId)}
                    type="button"
                    role="option"
                    aria-selected={false}
                  >
                    <span className="searchResultCategory">{result.category}</span>
                    <strong className="searchResultTitle">{short}</strong>
                    {short !== result.title ? (
                      <em className="searchResultFormal">{result.title}</em>
                    ) : null}
                    {reasons ? <small className="searchResultReason">{reasons}</small> : null}
                    {snip ? <ExpandableText text={snip} maxLength={140} /> : null}
                    {tags.length > 0 ? (
                      <small className="searchResultTags">{tags.slice(0, 4).join(' · ')}</small>
                    ) : null}
                  </button>
                );
              })}
              {visible < allResults.length ? (
                <button
                  type="button"
                  className="searchMoreBtn"
                  onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, allResults.length))}
                >
                  더 보기 ({allResults.length - visible}건 남음)
                </button>
              ) : null}
            </>
          ) : (
            <p className="emptyState">검색 결과가 없습니다. 다른 키워드나 코드 심볼을 시도해 보세요.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
