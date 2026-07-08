import { ExpandableText } from './ExpandableText';
import { searchDocuments } from '../lib/search';
import { getDisplayTitle } from '../lib/types';

type SearchPanelProps = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onSelect: (slug: string) => void;
};

export function SearchPanel({ query, onQueryChange, onSelect }: SearchPanelProps) {
  const results = searchDocuments(query);

  return (
    <section className="searchPanel" aria-label="Wiki search">
      <label htmlFor="wiki-search">문서 검색</label>
      <div className="searchInputWrap">
        <span className="searchIcon" aria-hidden="true">🔍</span>
        <input
          autoComplete="off"
          id="wiki-search"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="문서 제목, 카테고리, 태그, 본문 검색…"
          type="search"
          value={query}
        />
      </div>

      {query ? (
        <div className="searchResults" role="listbox" aria-label="검색 결과">
          {results.length ? (
            results.map((result) => (
              <button
                className="searchResult"
                key={result.slug}
                onClick={() => onSelect(result.slug)}
                type="button"
                role="option"
                aria-selected={false}
              >
                <span>{result.category}</span>
                <strong>{getDisplayTitle(result)}</strong>
                {result.excerpt ? (
                  <ExpandableText text={result.excerpt} maxLength={120} />
                ) : null}
                {result.tags.length > 0 ? (
                  <small>{result.tags.join(' · ')}</small>
                ) : null}
              </button>
            ))
          ) : (
            <p className="emptyState">검색 결과가 없습니다.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
