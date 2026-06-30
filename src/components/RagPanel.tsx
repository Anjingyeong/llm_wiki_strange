import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

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
  readonly answerMode?: string | undefined;
  readonly debugInfo?: unknown | undefined;
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
  const answerMode = typeof value.answerMode === 'string' ? value.answerMode : undefined;
  const debugInfo = value.debugInfo;

  const sources = Array.isArray(rawSources) ? rawSources.map(parseSource).filter((source) => source !== null) : [];
  if ((status !== 'answered' && status !== 'insufficient_context') || typeof answer !== 'string') {
    return { status: 'error', answer: 'RAG API 응답 형식이 올바르지 않습니다.', sources: [] };
  }
  return { status, answer, sources, answerMode, debugInfo };
}

const quickQuestions = [
  { label: '동작 흐름 설명', query: '스마트 안전 관제 시스템 동작 흐름' },
  { label: '기술 선택 근거', query: 'YOLO26n-pose를 선택한 근거는?' },
  { label: '검증 결과 요약', query: 'py_compile 검증 결과는?' },
  { label: '포트폴리오 문장', query: '이 프로젝트를 포트폴리오용으로 요약해줘' },
  { label: '면접 답변', query: 'RAG 기능의 포트폴리오 근거를 알려줘' }
];

export function RagPanel() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<RagResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const askQuestion = async (queryOverride?: string) => {
    const targetQuery = queryOverride !== undefined ? queryOverride : question;
    const trimmed = targetQuery.trim();
    if (!trimmed) {
      setResponse({ status: 'insufficient_context', answer: '질문을 입력해 주세요.', sources: [] });
      return;
    }

    if (queryOverride !== undefined) {
      setQuestion(queryOverride);
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
          <strong>문서 기반 질문 (Portfolio Assistant)</strong>
          <p>검색된 Wiki chunk를 활용해 질문 의도에 맞는 양식으로 자동 재조정합니다.</p>
        </div>
      </div>

      <div className="ragQuickQuestions" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {quickQuestions.map((qq) => (
          <button
            key={qq.label}
            onClick={() => askQuestion(qq.query)}
            disabled={loading}
            type="button"
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              cursor: 'pointer',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155'
            }}
          >
            {qq.label}
          </button>
        ))}
      </div>

      <label htmlFor="rag-question">질문</label>
      <textarea
        id="rag-question"
        onChange={(event) => setQuestion(event.currentTarget.value)}
        placeholder="예: yolo26n-pose를 선택한 근거는?"
        rows={3}
        value={question}
      />
      <button disabled={loading} onClick={() => askQuestion()} type="button">
        {loading ? '검색 중' : '답변 생성'}
      </button>

      {response ? (
        <div className={response.status === 'answered' ? 'ragAnswer' : 'ragAnswer insufficient'}>
          <div className="ragAnswerBody" style={{ color: '#1e293b' }}>
            <MarkdownRenderer markdown={response.answer} />
          </div>

          {response.sources.length ? (
            <div className="ragSources" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#475569' }}>참고 문서</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {response.sources.map((source) => (
                  <a 
                    href={source.sourceLink} 
                    key={`${source.documentId}-${source.section}`}
                    style={{ textDecoration: 'none', color: '#2563eb', fontSize: '14px' }}
                  >
                    <span style={{ fontWeight: '600' }}>{source.title}</span>
                    <small style={{ color: '#64748b', marginLeft: '0.5rem' }}>
                      ({source.section} · {source.documentId})
                    </small>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {response.debugInfo ? (
            <details className="ragDebugDetails" style={{ marginTop: '1.5rem', borderTop: '1px dotted #cbd5e1', paddingTop: '0.5rem' }}>
              <summary style={{ fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>개발자 디버그 정보 (score / query expansion)</summary>
              <pre style={{ background: '#f8fafc', padding: '10px', fontSize: '11px', overflowX: 'auto', borderRadius: '4px', marginTop: '0.5rem' }}>
                {JSON.stringify(response.debugInfo, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
