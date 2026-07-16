import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ANSWER_MODE_LABELS, QUICK_QUESTIONS } from './ragPanelData';

type RagSource = {
  readonly documentId: string;
  readonly section: string;
  readonly sourceLink: string;
  readonly displayTitle?: string | undefined;
  readonly title: string;
  readonly score?: number | undefined;
};

type RagResponse = {
  readonly status: 'answered' | 'insufficient_context' | 'error';
  readonly answer: string;
  readonly sources: readonly RagSource[];
  readonly answerMode?: string | undefined;
  readonly fallback?: boolean | undefined;
  readonly fallbackReason?: string | undefined;
  readonly debugInfo?: unknown | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSource(value: unknown): RagSource | null {
  if (!isRecord(value)) return null;
  const { documentId, section, sourceLink, displayTitle, title, score } = value;
  if (
    typeof documentId !== 'string' ||
    typeof section !== 'string' ||
    typeof sourceLink !== 'string' ||
    typeof title !== 'string'
  ) return null;
  return {
    documentId,
    section,
    sourceLink,
    displayTitle: typeof displayTitle === 'string' ? displayTitle : undefined,
    title,
    score: typeof score === 'number' ? score : undefined,
  };
}

function parseRagResponse(value: unknown): RagResponse {
  if (!isRecord(value)) {
    return { status: 'error', answer: 'RAG API 응답을 읽을 수 없습니다.', sources: [] };
  }
  const { status, answer, sources: rawSources, answerMode, fallback, fallbackReason, debugInfo } = value;
  const sources = Array.isArray(rawSources)
    ? rawSources.map(parseSource).filter((s): s is RagSource => s !== null)
    : [];
  if ((status !== 'answered' && status !== 'insufficient_context') || typeof answer !== 'string') {
    return { status: 'error', answer: 'RAG API 응답 형식이 올바르지 않습니다.', sources: [] };
  }
  return {
    status,
    answer,
    sources,
    answerMode: typeof answerMode === 'string' ? answerMode : undefined,
    fallback: typeof fallback === 'boolean' ? fallback : undefined,
    fallbackReason: typeof fallbackReason === 'string' ? fallbackReason : undefined,
    debugInfo,
  };
}

function AnswerModeBadge({ mode }: { readonly mode: string }) {
  return (
    <span className="ragAnswerMode" data-mode={mode}>
      {ANSWER_MODE_LABELS[mode] ?? mode}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="ragLoadingCard" aria-label="답변을 생성 중입니다" aria-busy="true">
      <div className="ragSkeleton h-4 w-3/4" />
      <div className="ragSkeleton h-3 w-full" />
      <div className="ragSkeleton h-3 w-full" />
      <div className="ragSkeleton h-3 w-1/2" />
    </div>
  );
}

export function RagPanel() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<RagResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const askQuestion = async (queryOverride?: string) => {
    const target = queryOverride !== undefined ? queryOverride : question;
    const trimmed = target.trim();
    if (!trimmed) {
      setResponse({
        status: 'insufficient_context',
        answer: '질문을 입력해 주세요.',
        sources: [],
      });
      return;
    }
    if (queryOverride !== undefined) setQuestion(queryOverride);
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload: unknown = await res.json();
      setResponse(parseRagResponse(payload));
    } catch {
      setResponse({
        status: 'error',
        answer: 'RAG API에 연결할 수 없습니다. Cloudflare Pages Functions 또는 `npm start`를 확인하세요.',
        sources: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const statusClass =
    response?.status === 'insufficient_context'
      ? 'ragAnswer insufficient'
      : response?.status === 'error'
        ? 'ragAnswer error'
        : 'ragAnswer';

  return (
    <section className="ragPanel" aria-label="문서 기반 Portfolio Assistant">

      {/* Header */}
      <div className="ragPanelHeader">
        <div>
          <strong>Portfolio Assistant</strong>
          <p>Wiki 문서 기반 RAG 검색 · 근거 추출 · 포트폴리오 재구성</p>
        </div>
      </div>

      {/* Body */}
      <div className="ragPanelBody">

        {/* Quick buttons */}
        <div className="ragQuickButtons" role="group" aria-label="빠른 질문">
          {QUICK_QUESTIONS.map((qq) => (
            <button
              className="ragQuickBtn"
              disabled={loading}
              key={qq.label}
              onClick={() => askQuestion(qq.query)}
              type="button"
              title={qq.query}
            >
              {qq.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <label htmlFor="rag-question">질문 입력</label>
        <div className="ragInputWrap">
          <textarea
            id="rag-question"
            onChange={(e) => setQuestion(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void askQuestion();
              }
            }}
            placeholder="예: YOLO26n-pose를 선택한 근거는?  (Ctrl+Enter로 전송)"
            rows={3}
            value={question}
          />
        </div>

        <button
          className="ragSubmitBtn"
          disabled={loading}
          onClick={() => askQuestion()}
          type="button"
        >
          {loading ? '⏳ 검색 중…' : '✨ 답변 생성'}
        </button>

        {/* Loading skeleton */}
        {loading ? <LoadingSkeleton /> : null}

        {/* Answer card */}
        {!loading && response ? (
          <div className={statusClass}>

            {/* Answer card header */}
            <div className="ragAnswerHeader">
              <span className="ragAnswerLabel">
                {response.status === 'insufficient_context'
                  ? '⚠️ 근거 부족'
                  : response.status === 'error'
                    ? '❌ 오류'
                    : response.fallback
                      ? '📋 검색 결과 (RAG-only)'
                      : '🤖 AI 답변'}
              </span>
              {response.answerMode ? (
                <AnswerModeBadge mode={response.answerMode} />
              ) : null}
            </div>

            {/* Answer body rendered as Markdown */}
            <div className="ragAnswerBody">
              <MarkdownRenderer markdown={response.answer} />
            </div>

            {/* Sources */}
            {response.sources.length > 0 ? (
              <div className="ragSources">
                <div className="ragSourcesLabel">
                  📚 참고 문서 ({response.sources.length})
                </div>
                <div className="ragSourceList">
                  {response.sources.map((src) => (
                    <a
                      className="ragSourceChip"
                      href={src.sourceLink}
                      key={`${src.documentId}-${src.section}`}
                      title={`${src.displayTitle ?? src.title} › ${src.section}`}
                    >
                      <span>{src.displayTitle ?? src.title}</span>
                      <span className="chipSection">· {src.section}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Debug details */}
            {response.debugInfo ? (
              <details className="ragDebugDetails">
                <summary>🛠 개발자 디버그 정보 (score · query expansion)</summary>
                <pre className="ragDebugPre">
                  {JSON.stringify(response.debugInfo, null, 2)}
                </pre>
              </details>
            ) : null}

          </div>
        ) : null}

        {/* Empty hint when no response yet */}
        {!loading && !response ? (
          <div className="ragEmptyHint">
            <span className="ragEmptyIcon">🤖</span>
            <span>Wiki 문서를 기반으로 근거 있는 답변을 생성합니다.</span>
            <span>위 빠른 버튼을 눌러 시작하거나 직접 질문을 입력하세요.</span>
          </div>
        ) : null}

      </div>
    </section>
  );
}
