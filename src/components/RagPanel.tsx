import { useState } from 'react';

type RagSource = {
  readonly documentId: string;
  readonly section: string;
  readonly sourceLink: string;
  readonly title: string;
};

type RagResponse = {
  readonly status: 'answered' | 'insufficient_context' | 'error';
  readonly answer: string;
  readonly sources: readonly RagSource[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSource(value: unknown): RagSource | null {
  if (!isRecord(value)) {
    return null;
  }
  const { documentId, section, sourceLink, title } = value;
  if (
    typeof documentId !== 'string' ||
    typeof section !== 'string' ||
    typeof sourceLink !== 'string' ||
    typeof title !== 'string'
  ) {
    return null;
  }
  return { documentId, section, sourceLink, title };
}

function parseRagResponse(value: unknown): RagResponse {
  if (!isRecord(value)) {
    return { status: 'error', answer: 'RAG API 응답을 읽을 수 없습니다.', sources: [] };
  }
  const status = value.status;
  const answer = value.answer;
  const rawSources = value.sources;
  const sources = Array.isArray(rawSources) ? rawSources.map(parseSource).filter((source) => source !== null) : [];
  if ((status !== 'answered' && status !== 'insufficient_context') || typeof answer !== 'string') {
    return { status: 'error', answer: 'RAG API 응답 형식이 올바르지 않습니다.', sources: [] };
  }
  return { status, answer, sources };
}

export function RagPanel() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<RagResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const askQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setResponse({ status: 'insufficient_context', answer: '질문을 입력해 주세요.', sources: [] });
      return;
    }

    setLoading(true);
    try {
      const apiResponse = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload: unknown = await apiResponse.json();
      setResponse(parseRagResponse(payload));
    } catch (error) {
      setResponse({ status: 'error', answer: 'RAG API에 연결할 수 없습니다. 서버에서 `npm start`를 실행했는지 확인하세요.', sources: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ragPanel" aria-label="문서 기반 질의응답">
      <div className="ragPanelHeader">
        <div>
          <strong>문서 기반 질문</strong>
          <p>검색된 Wiki chunk만 context로 사용합니다.</p>
        </div>
      </div>
      <label htmlFor="rag-question">질문</label>
      <textarea
        id="rag-question"
        onChange={(event) => setQuestion(event.currentTarget.value)}
        placeholder="예: yolo26n-pose를 선택한 근거는?"
        rows={3}
        value={question}
      />
      <button disabled={loading} onClick={askQuestion} type="button">
        {loading ? '검색 중' : '답변 생성'}
      </button>
      {response ? (
        <div className={response.status === 'answered' ? 'ragAnswer' : 'ragAnswer insufficient'}>
          <p>{response.answer}</p>
          {response.sources.length ? (
            <div className="ragSources">
              <strong>참고 문서</strong>
              {response.sources.map((source) => (
                <a href={source.sourceLink} key={`${source.documentId}-${source.section}`}>
                  <span>{source.title}</span>
                  <small>
                    {source.section} · {source.documentId}
                  </small>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
