import { useEffect, useMemo, useState } from 'react';
import { ExpandableText } from './ExpandableText';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ANSWER_MODE_LABELS, QUICK_QUESTIONS } from './ragPanelData';
import { wikiUxMeta } from '../generated/wikiUxMeta';
import { SEARCH_RESULT_LIMIT_MAX, searchDocuments } from '../lib/search';
import { getDisplayTitle } from '../lib/types';
import { writeViewHash } from '../lib/wikiHash';

type TabId = 'search' | 'ask' | 'system';

type RagSource = {
  readonly documentId: string;
  readonly section: string;
  readonly sourceLink: string;
  readonly displayTitle?: string;
  readonly title: string;
  readonly score?: number;
};

type RagResponse = {
  readonly status: string;
  readonly answer: string;
  readonly sources: readonly RagSource[];
  readonly answerMode?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSource(value: unknown): RagSource | null {
  if (!isRecord(value)) return null;
  const { documentId, section, sourceLink, displayTitle, title, score } = value;
  if (typeof documentId !== 'string' || typeof section !== 'string' || typeof sourceLink !== 'string' || typeof title !== 'string') {
    return null;
  }
  return {
    documentId,
    section,
    sourceLink,
    ...(typeof displayTitle === 'string' ? { displayTitle } : {}),
    title,
    ...(typeof score === 'number' ? { score } : {}),
  };
}

function parseRagResponse(value: unknown): RagResponse {
  if (!isRecord(value)) {
    return { status: 'error', answer: 'Invalid response', sources: [] };
  }
  const sources = Array.isArray(value.sources)
    ? value.sources.map(parseSource).filter((s): s is RagSource => s !== null)
    : [];
  return {
    status: typeof value.status === 'string' ? value.status : 'answered',
    answer: typeof value.answer === 'string' ? value.answer : '',
    sources,
    ...(typeof value.answerMode === 'string' ? { answerMode: value.answerMode } : {}),
  };
}

const PAGE_SIZE = 12;

type WikiToolsPanelProps = {
  readonly initialTab?: TabId;
  readonly onSelectDocument: (slug: string, sectionId?: string | null) => void;
};

export function WikiToolsPanel({ initialTab = 'search', onSelectDocument }: WikiToolsPanelProps) {
  const [tab, setTab] = useState<TabId>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);
  const [ragResult, setRagResult] = useState<RagResponse | null>(null);

  const allResults = useMemo(
    () => searchDocuments(query, { limit: SEARCH_RESULT_LIMIT_MAX }),
    [query],
  );
  const results = allResults.slice(0, visible);

  const askRag = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRagLoading(true);
    setRagError(null);
    setRagResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const key = (typeof window !== 'undefined' && window.sessionStorage.getItem('wiki_access_key')) || '';
      if (key) headers['x-wiki-key'] = key;
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: trimmed }),
      });
      if (res.status === 401) {
        // clear key and bubble up
        try { window.sessionStorage.removeItem('wiki_access_key'); } catch {}
        setRagError('인증이 필요합니다. 접근 키를 다시 입력하세요.');
        if ((window as any).__onWikiAuthRequired) (window as any).__onWikiAuthRequired();
        return;
      }
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = isRecord(json) && typeof json.error === 'string' ? json.error : res.statusText;
        throw new Error(msg);
      }
      setRagResult(parseRagResponse(json));
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'RAG request failed');
    } finally {
      setRagLoading(false);
    }
  };

  const meta = wikiUxMeta;
  const b = meta.benchmark;
  const s3 = b.stage3Eval;

  return (
    <section className="wikiToolsPanel" aria-label="Wiki 검색 및 RAG">
      <div className="wikiToolsTabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'search'}
          className={tab === 'search' ? 'wikiToolsTab active' : 'wikiToolsTab'}
          onClick={() => setTab('search')}
        >
          문서 검색
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ask'}
          className={tab === 'ask' ? 'wikiToolsTab active' : 'wikiToolsTab'}
          onClick={() => setTab('ask')}
        >
          RAG 질의
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'system'}
          className={tab === 'system' ? 'wikiToolsTab active' : 'wikiToolsTab'}
          onClick={() => setTab('system')}
        >
          RAG 구성·수치
        </button>
      </div>

      {tab === 'search' ? (
        <div className="wikiToolsPane" role="tabpanel">
          <p className="wikiToolsHint">
            제목·slug·코드 심볼·한글 별칭·본문을 검색합니다. archived 문서는 인덱스에서 제외됩니다.
          </p>
          <div className="searchInputWrap">
            <span className="searchIcon" aria-hidden="true">⌕</span>
            <input
              aria-label="Wiki 문서 검색"
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="frameId, develop 기준선, YOLO26n, MQTT…"
              type="search"
              value={query}
            />
          </div>
          {query.trim() ? (
            <div className="searchResults" role="listbox">
              {results.length === 0 ? (
                <p className="emptyState">일치하는 문서가 없습니다 (임계값 18).</p>
              ) : (
                results.map((result) => (
                  <button
                    className="searchResult"
                    key={`${result.slug}-${result.matchedSectionId ?? ''}`}
                    onClick={() => onSelectDocument(result.slug, result.matchedSectionId)}
                    type="button"
                    role="option"
                  >
                    <span>{result.category}</span>
                    <strong className="searchResultTitle">{getDisplayTitle(result)}</strong>
                    <ExpandableText text={result.snippet ?? result.excerpt} maxLength={160} />
                    {result.matchReasons?.length ? (
                      <small className="searchResultReason">{result.matchReasons.slice(0, 3).join(' · ')}</small>
                    ) : null}
                  </button>
                ))
              )}
              {allResults.length > visible ? (
                <button className="searchMoreBtn" type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  더 보기 ({visible}/{allResults.length})
                </button>
              ) : null}
            </div>
          ) : (
            <p className="emptyState">검색어를 입력하세요. 왼쪽에서 문서를 고르거나 RAG 탭에서 질문할 수 있습니다.</p>
          )}
        </div>
      ) : null}

      {tab === 'ask' ? (
        <div className="wikiToolsPane ragPanelBody" role="tabpanel">
          <p className="wikiToolsHint">Wiki 청크만 근거로 답합니다. 근거 부족 시 insufficient_context.</p>
          <div className="ragQuickButtons" role="group" aria-label="빠른 질문">
            {QUICK_QUESTIONS.map((suggestion) => (
              <button
                className="ragQuickBtn"
                disabled={ragLoading}
                key={suggestion.query}
                onClick={() => {
                  setRagQuestion(suggestion.query);
                  void askRag(suggestion.query);
                }}
                type="button"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
          <form
            className="ragAskForm"
            onSubmit={(e) => {
              e.preventDefault();
              void askRag(ragQuestion);
            }}
          >
            <textarea
              aria-label="RAG 질문"
              disabled={ragLoading}
              onChange={(e) => setRagQuestion(e.target.value)}
              placeholder="예: faint cooldown 60초 develop 기준선은?"
              rows={3}
              value={ragQuestion}
            />
            <button className="submitBtn" disabled={ragLoading || !ragQuestion.trim()} type="submit">
              {ragLoading ? '검색 중…' : '질문하기'}
            </button>
          </form>
          {ragError ? <p className="errorMessage">{ragError}</p> : null}
          {ragResult ? (
            <div className={`ragAnswer llm22-answer-card ${ragResult.status === 'insufficient_context' ? 'insufficient' : ''}`}>
              <div className="ragAnswerQuestion">
                <strong>질문</strong>
                <span className="qtext">{ragQuestion || '(직전 질문)'}</span>
              </div>
              <div className="ragAnswerMeta">
                <span className="badge badge-neutral">{ragResult.status}</span>
                {ragResult.answerMode ? (
                  <span className="badge badge-blue">{ANSWER_MODE_LABELS[ragResult.answerMode] ?? ragResult.answerMode}</span>
                ) : null}
              </div>
              <div className="ragAnswerSummary">
                {(() => { const first = (ragResult.answer || '').split(/[.\n]/)[0] || ''; return first.length > 120 ? first.slice(0, 117) + '...' : first; })()}
              </div>
              <div className="ragAnswerActions">
                <button type="button" className="btn-secondary btn-copy" onClick={() => { navigator.clipboard?.writeText(ragResult.answer || ''); }}>복사</button>
                <button type="button" className="btn-secondary btn-newq" onClick={() => { setRagResult(null); setRagQuestion(''); }}>새 질문</button>
              </div>
              <div className="ragAnswerBody">
                <MarkdownRenderer markdown={ragResult.answer} />
              </div>
              {ragResult.sources.length > 0 ? (
                <div className="ragSources">
                  <strong>출처</strong>
                  <div className="ragSourceChips">
                    {ragResult.sources.map((src) => (
                      <a
                        className="ragSourceChip"
                        href={src.sourceLink.startsWith('#') ? src.sourceLink : `#${src.sourceLink}`}
                        key={`${src.documentId}-${src.section}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const link = src.sourceLink.replace(/^#\/?/, '');
                          const slash = link.indexOf('/');
                          const slug = slash === -1 ? decodeURIComponent(link) : decodeURIComponent(link.slice(0, slash));
                          const section = slash === -1 ? null : decodeURIComponent(link.slice(slash + 1));
                          onSelectDocument(slug, section);
                        }}
                        title={`${src.displayTitle ?? src.title} › ${src.section}`}
                      >
                        {src.displayTitle ?? src.title}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'system' ? (
        <div className="wikiToolsPane wikiRagSystem" role="tabpanel">
          <h2 className="wikiRagSystemTitle">검색·RAG 한 화면 요약</h2>
          <table>
            <tbody>
              <tr>
                <th>Client 검색 인덱스</th>
                <td>
                  {meta.searchDocCount}문서 · corpus {meta.search.corpusHash?.slice(0, 12)}… ·{' '}
                  {meta.search.generatedAt?.slice(0, 10)}
                </td>
              </tr>
              <tr>
                <th>RAG 벡터 인덱스</th>
                <td>
                  {meta.rag.documentCount}문서 · {meta.rag.chunkCount}청크 · corpus {meta.rag.corpusHash.slice(0, 12)}… ·{' '}
                  {meta.rag.indexGeneratedAt.slice(0, 10)} · mean {meta.rag.meanChunkChars} chars
                </td>
              </tr>
              <tr>
                <th>운영 retrieval</th>
                <td>{b.operationalRetrieval}</td>
              </tr>
              <tr>
                <th>다양화·중복</th>
                <td>{b.diversify}</td>
              </tr>
              <tr>
                <th>임베딩·청킹</th>
                <td>
                  {b.embedding} · {b.chunking}
                </td>
              </tr>
              <tr>
                <th>답변 정책</th>
                <td>{b.abstention}</td>
              </tr>
            </tbody>
          </table>

          <h3>오프라인 평가 (Stage-3, golden 55)</h3>
          <p className="wikiToolsHint">{s3.note}</p>
          <table>
            <thead>
              <tr>
                <th>후보</th>
                <th>Hit@5</th>
                <th>Recall@5</th>
                <th>MRR</th>
                <th>중복(청크)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>hybrid-rrf (운영 유사)</td>
                <td>{s3.hybridRrf.hitAt5}</td>
                <td>{s3.hybridRrf.recallAt5}</td>
                <td>{s3.hybridRrf.mrr}</td>
                <td>{s3.hybridRrf.duplicateResult}</td>
              </tr>
              <tr>
                <td>hybrid-diversify-max2</td>
                <td>{s3.hybridDiversifyMax2.hitAt5}</td>
                <td>{s3.hybridDiversifyMax2.recallAt5}</td>
                <td>{s3.hybridDiversifyMax2.mrr}</td>
                <td>{s3.hybridDiversifyMax2.duplicateResult}</td>
              </tr>
              <tr>
                <td>diversify-max1 (dup↓)</td>
                <td>{s3.diversifyMax1.hitAt5}</td>
                <td>{s3.diversifyMax1.recallAt5}</td>
                <td>—</td>
                <td>{s3.diversifyMax1.duplicateChunkDup}</td>
              </tr>
            </tbody>
          </table>

          <h3>최근 개선 (2026-07-15)</h3>
          <ul>
            <li>사이드바 검색: slug당 1건, develop/기준선 별칭</li>
            <li>RAG API sources: 문서(slug) 단위 dedupe</li>
            <li>archived daily 로그는 client 인덱스 제외</li>
          </ul>
          <p className="wikiToolsHint">
            상세: <button type="button" className="linkish" onClick={() => onSelectDocument('Evidence-LLM-Wiki-RAG')}>Evidence-LLM-Wiki-RAG</button>
            · Graph: <a href="/graphify/graph-core.html" target="_blank" rel="noopener noreferrer">graph-core.html</a>
          </p>
        </div>
      ) : null}

      <div className="wikiToolsFooter">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => writeViewHash(tab === 'ask' ? 'rag' : 'search')}
        >
          URL에 #{tab === 'ask' ? '__rag__' : '__search__'} 고정
        </button>
      </div>
    </section>
  );
}
