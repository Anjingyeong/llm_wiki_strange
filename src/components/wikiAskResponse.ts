export type RagSource = {
  readonly documentId: string;
  readonly section: string;
  readonly sourceLink: string;
  readonly displayTitle?: string;
  readonly title: string;
  readonly score?: number;
};

export type RagResponse = {
  readonly status: 'answered' | 'insufficient_context' | 'error';
  readonly answer: string;
  readonly sources: readonly RagSource[];
  readonly answerMode?: string;
  readonly fallback?: boolean;
  readonly fallbackReason?: string;
  readonly debugInfo?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSource(value: unknown): RagSource | null {
  if (!isRecord(value)) return null;
  const { displayTitle, documentId, score, section, sourceLink, title } = value;
  if (typeof documentId !== 'string' || typeof section !== 'string' || typeof sourceLink !== 'string' || typeof title !== 'string') return null;
  return {
    documentId,
    section,
    sourceLink,
    title,
    ...(typeof displayTitle === 'string' ? { displayTitle } : {}),
    ...(typeof score === 'number' ? { score } : {}),
  };
}

export function parseRagResponse(value: unknown): RagResponse {
  if (!isRecord(value)) return { status: 'error', answer: 'RAG API 응답을 읽을 수 없습니다.', sources: [] };
  const { answer, answerMode, debugInfo, fallback, fallbackReason, sources, status } = value;
  if ((status !== 'answered' && status !== 'insufficient_context' && status !== 'error') || typeof answer !== 'string') {
    return { status: 'error', answer: 'RAG API 응답 형식이 올바르지 않습니다.', sources: [] };
  }
  return {
    status,
    answer,
    sources: Array.isArray(sources) ? sources.map(parseSource).filter((source): source is RagSource => source !== null) : [],
    ...(typeof answerMode === 'string' ? { answerMode } : {}),
    ...(typeof fallback === 'boolean' ? { fallback } : {}),
    ...(typeof fallbackReason === 'string' ? { fallbackReason } : {}),
    ...(debugInfo === undefined ? {} : { debugInfo }),
  };
}
