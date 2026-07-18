import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { QUICK_QUESTIONS } from './ragPanelData';
import { parseRagResponse, type RagResponse } from './wikiAskResponse';
import { clearWikiAccessKey, getWikiAccessKey } from '../lib/wikiAccessKey';

type WikiAskWorkspaceProps = {
  readonly onAuthRequired: () => void;
  readonly onReturnToDocument: () => void;
  readonly onSelectDocument: (slug: string, sectionId?: string | null) => void;
};

const ANSWER_MODE_LABELS: Readonly<Record<string, string>> = {
  flow_mode: '동작 흐름',
  evidence_template: '검증 근거',
  portfolio_mode: '포트폴리오',
  troubleshooting_mode: '문제 해결',
  general: '일반',
};

const RESPONSE_STATUS_LABELS: Readonly<Record<RagResponse['status'], string>> = {
  answered: '답변 완료',
  insufficient_context: '근거 부족',
  error: '요청 실패',
};

function isUnmodifiedPrimaryClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

function sourceTarget(sourceLink: string): { readonly slug: string; readonly sectionId: string | null } {
  const link = sourceLink.replace(/^#\/?/, '');
  const slash = link.indexOf('/');
  return {
    slug: decodeURIComponent(slash === -1 ? link : link.slice(0, slash)),
    sectionId: slash === -1 ? null : decodeURIComponent(link.slice(slash + 1)),
  };
}

export function WikiAskWorkspace({ onAuthRequired, onReturnToDocument, onSelectDocument }: WikiAskWorkspaceProps) {
  const [question, setQuestion] = useState('');
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RagResponse | null>(null);

  const askQuestion = async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    setLastSubmittedQuestion(trimmed);
    setLoading(true);
    setResponse(null);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const key = getWikiAccessKey();
    if (key) headers['x-wiki-key'] = key;
    try {
      const result = await fetch('/api/rag/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: trimmed }),
      });
      if (result.status === 401) {
        clearWikiAccessKey();
        setResponse({ status: 'error', answer: '인증이 만료되었습니다. 접근 키를 다시 입력해 주세요.', sources: [] });
        onAuthRequired();
        return;
      }
      const payload: unknown = await result.json();
      setResponse(result.ok ? parseRagResponse(payload) : { status: 'error', answer: '질문 처리 요청이 실패했습니다.', sources: [] });
    } catch (error) {
      setResponse({
        status: 'error',
        answer: error instanceof Error ? error.message : 'RAG 서비스에 연결할 수 없습니다.',
        sources: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const statusMessage = loading
    ? 'Wiki 근거를 검색하고 있습니다.'
    : response?.status === 'answered'
      ? '근거 기반 답변이 준비되었습니다.'
      : response?.status === 'insufficient_context'
        ? '충분한 근거를 찾지 못했습니다.'
        : response?.status === 'error'
          ? '답변 요청에 실패했습니다.'
          : '질문 준비됨';

  return (
    <section aria-busy={loading} aria-labelledby="wiki-ask-title" className="wikiWorkspace wikiAskWorkspace">
      <header className="wikiWorkspaceHeader">
        <div><span className="workspaceEyebrow">Grounded answer</span><h1 id="wiki-ask-title">Wiki에 질문</h1></div>
        <button className="workspaceBack" onClick={onReturnToDocument} type="button">문서로 돌아가기</button>
      </header>
      <p className="workspaceHint">공개 Wiki 청크만 근거로 답하며, 근거가 약하면 답변을 보류합니다.</p>
      <div aria-label="빠른 질문" className="ragQuickButtons" role="group">
        {QUICK_QUESTIONS.slice(0, 5).map((suggestion) => (
          <button disabled={loading} key={suggestion.query} onClick={() => { setQuestion(suggestion.query); void askQuestion(suggestion.query); }} type="button">
            {suggestion.label}
          </button>
        ))}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void askQuestion(question); }}>
        <label htmlFor="wiki-ask-question">질문</label>
        <textarea disabled={loading} id="wiki-ask-question" onChange={(event) => setQuestion(event.currentTarget.value)} rows={4} value={question} />
        <button disabled={loading || !question.trim()} type="submit">{loading ? '근거 검색 중' : '질문하기'}</button>
      </form>
      <p aria-live="polite" className="workspaceLiveStatus">{statusMessage}</p>
      {response ? (
        <section className={`ragAnswer ${response.status}`} aria-label="Wiki 답변">
          <header>
            <span className="ragStatusLabel">{RESPONSE_STATUS_LABELS[response.status]}</span>
            {response.answerMode ? <span>{ANSWER_MODE_LABELS[response.answerMode] ?? response.answerMode}</span> : null}
            {response.fallback ? <span>문서 검색 기반</span> : null}
          </header>
          <p className="ragQuestion">질문: {lastSubmittedQuestion}</p>
          <div className="ragAnswerBody"><MarkdownRenderer markdown={response.answer} /></div>
          {response.sources.length ? (
            <section aria-labelledby="rag-sources-title" className="ragSources">
              <h2 id="rag-sources-title">근거 문서</h2>
              <ul>
                {response.sources.map((source) => (
                  <li key={`${source.documentId}-${source.section}`}>
                    <a
                      href={source.sourceLink.startsWith('#') ? source.sourceLink : `#/${source.sourceLink}`}
                      onClick={(event) => {
                        if (!isUnmodifiedPrimaryClick(event)) return;
                        event.preventDefault();
                        const target = sourceTarget(source.sourceLink);
                        onSelectDocument(target.slug, target.sectionId);
                      }}
                    >
                      <strong>{source.displayTitle ?? source.title}</strong><span>{source.section}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {response.debugInfo === undefined && response.fallbackReason === undefined ? null : (
            <details className="ragDebugDetails"><summary>검색 진단 정보</summary><pre>{JSON.stringify({ debugInfo: response.debugInfo, fallbackReason: response.fallbackReason }, null, 2)}</pre></details>
          )}
        </section>
      ) : null}
    </section>
  );
}
