import { useEffect, useReducer } from 'react';
import type { Ref } from 'react';

import { wikiUxMeta } from '../generated/wikiUxMeta';

type StatusHeaderProps = {
  readonly onMenuClick?: () => void;
  readonly menuOpen: boolean;
  readonly menuButtonRef: Ref<HTMLButtonElement>;
  readonly sidebarId: string;
  readonly title?: string;
};

type HealthState = 'checking' | 'healthy' | 'stale' | 'error' | 'unknown';

type HealthPayload = {
  readonly stale: boolean | null;
  readonly staleReasons: readonly string[];
  readonly llmAnswerMode: string | null;
};

type RuntimeHealthResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly data: unknown;
};

type HealthStatus = {
  readonly state: HealthState;
  readonly staleReasons: readonly string[];
  readonly statusReason: string;
  readonly checkedAt: string | null;
  readonly llmMode: string;
};

type HealthAction = {
  readonly type: 'replace';
  readonly status: HealthStatus;
};

const INITIAL_HEALTH_STATUS: HealthStatus = {
  state: 'checking',
  staleReasons: [],
  statusReason: '런타임 상태를 확인하고 있습니다.',
  checkedAt: null,
  llmMode: 'rag_only',
};

function healthReducer(_current: HealthStatus, action: HealthAction): HealthStatus {
  return action.status;
}

async function requestRuntimeHealth(signal: AbortSignal): Promise<RuntimeHealthResponse> {
  const response = await fetch('/api/rag/health', { method: 'GET', signal });
  const data: unknown = await response.json();
  return { ok: response.ok, status: response.status, data };
}

function parseHealthPayload(value: unknown): HealthPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const stale = Reflect.get(value, 'stale');
  const staleReasons = Reflect.get(value, 'staleReasons');
  const llmAnswerMode = Reflect.get(value, 'llmAnswerMode');

  return {
    stale: typeof stale === 'boolean' ? stale : null,
    staleReasons: Array.isArray(staleReasons)
      ? staleReasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    llmAnswerMode: typeof llmAnswerMode === 'string' ? llmAnswerMode : null,
  };
}

const HEALTH_LABELS = {
  checking: '확인 중',
  healthy: '정상',
  stale: '인덱스 오래됨',
  error: '확인 실패',
  unknown: '상태 알 수 없음',
} as const satisfies Record<HealthState, string>;

export function StatusHeader({
  onMenuClick,
  menuOpen,
  menuButtonRef,
  sidebarId,
  title = 'Smart Safety AI Wiki',
}: StatusHeaderProps) {
  const [health, dispatchHealth] = useReducer(healthReducer, INITIAL_HEALTH_STATUS);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    requestRuntimeHealth(controller.signal)
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        const checkedAt = new Date().toISOString();
        if (!ok) {
          dispatchHealth({
            type: 'replace',
            status: {
              state: 'error',
              staleReasons: [],
              statusReason: `상태 엔드포인트가 HTTP ${status}로 응답했습니다.`,
              checkedAt,
              llmMode: 'rag_only',
            },
          });
          return;
        }

        const health = parseHealthPayload(data);
        if (health === null || health.stale === null) {
          dispatchHealth({
            type: 'replace',
            status: {
              state: 'unknown',
              staleReasons: [],
              statusReason: '응답에 stale 불리언 값이 없어 상태를 판정할 수 없습니다.',
              checkedAt,
              llmMode: 'rag_only',
            },
          });
          return;
        }

        if (health.stale === false) {
          dispatchHealth({
            type: 'replace',
            status: {
              state: 'healthy',
              staleReasons: health.staleReasons,
              statusReason: '런타임 인덱스가 최신 상태라고 응답했습니다.',
              checkedAt,
              llmMode: health.llmAnswerMode ?? 'rag_only',
            },
          });
          return;
        }
        dispatchHealth({
          type: 'replace',
          status: {
            state: 'stale',
            staleReasons: health.staleReasons,
            statusReason: '런타임 인덱스에 갱신이 필요합니다.',
            checkedAt,
            llmMode: health.llmAnswerMode ?? 'rag_only',
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        dispatchHealth({
          type: 'replace',
          status: {
            state: 'error',
            staleReasons: [],
            statusReason: error instanceof Error ? error.message : '상태 확인 중 알 수 없는 오류가 발생했습니다.',
            checkedAt: new Date().toISOString(),
            llmMode: 'rag_only',
          },
        });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const meta = wikiUxMeta;
  const modeLabel = health.llmMode === 'llm' ? 'LLM Answer' : 'RAG-only';
  const searchGeneratedDate = meta.search.generatedAt.slice(0, 10);
  const ragGeneratedDate = meta.rag.indexGeneratedAt.slice(0, 10);
  const badgeClass = health.state === 'healthy'
    ? 'badge-accent'
    : health.state === 'stale'
      ? 'badge-warning'
      : health.state === 'error'
        ? 'badge-danger'
        : 'badge-neutral';

  return (
    <header className="statusHeader header-h">
      <button
        ref={menuButtonRef}
        type="button"
        className="mobileMenuBtn"
        onClick={onMenuClick}
        aria-label={menuOpen ? '사이드바 메뉴 닫기' : '사이드바 메뉴 열기'}
        aria-expanded={menuOpen}
        aria-controls={sidebarId}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="statusHeaderTitle">{title}</div>
      <div className="statusHeaderSubtitle">실시간 영상관제 시스템의 설계·실험·운영 근거</div>
      <div className="statusHeaderStatus">
        <div className="runtimeHealth" aria-live="polite">
          <span className={`badge ${badgeClass}`}>런타임 · {HEALTH_LABELS[health.state]} · {modeLabel}</span>
          {health.checkedAt ? <time dateTime={health.checkedAt}>{new Date(health.checkedAt).toLocaleTimeString('ko-KR')} 확인</time> : null}
          <p className="statusReason">{health.statusReason}</p>
          {health.staleReasons.length > 0 ? (
            <ul className="staleReasons">{health.staleReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          ) : null}
        </div>
        <p className="buildFacts">
          <strong>빌드 시점</strong> · 검색 {meta.search.documentCount}개 ({meta.search.source}, {searchGeneratedDate}) · RAG {meta.rag.documentCount}개/{meta.rag.chunkCount}청크 ({ragGeneratedDate})
        </p>
      </div>
    </header>
  );
}
