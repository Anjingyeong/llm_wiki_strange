import { searchDocuments } from '../lib/search';

type SearchPanelProps = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onSelect: (slug: string) => void;
};

export function SearchPanel({ query, onQueryChange, onSelect }: SearchPanelProps) {
  const results = searchDocuments(query);

  return (
    <section className="searchPanel" aria-label="Wiki search">
      <label htmlFor="wiki-search">검색</label>
      <input
        autoComplete="off"
        id="wiki-search"
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="문서 제목, 카테고리, 태그, 본문 검색"
        type="search"
        value={query}
      />
      {query ? (
        <div className="searchResults">
          {results.length ? (
            results.map((result) => (
              <button className="searchResult" key={result.slug} onClick={() => onSelect(result.slug)} type="button">
                <span>{result.category}</span>
                <strong>{result.title}</strong>
                <p>{result.excerpt}</p>
                <small>{result.tags.join(' · ')}</small>
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
