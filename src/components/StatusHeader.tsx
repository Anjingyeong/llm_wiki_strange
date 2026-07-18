import { useEffect, useState } from 'react';
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
  const [healthState, setHealthState] = useState<HealthState>('checking');
  const [staleReasons, setStaleReasons] = useState<readonly string[]>([]);
  const [statusReason, setStatusReason] = useState('런타임 상태를 확인하고 있습니다.');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [llmMode, setLlmMode] = useState('rag_only');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/rag/health', { method: 'GET' })
      .then(async (response) => ({ ok: response.ok, status: response.status, data: await response.json() }))
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        setCheckedAt(new Date().toISOString());
        if (!ok) {
          setHealthState('error');
          setStatusReason(`상태 엔드포인트가 HTTP ${status}로 응답했습니다.`);
          return;
        }

        const health = parseHealthPayload(data);
        if (health === null || health.stale === null) {
          setHealthState('unknown');
          setStatusReason('응답에 stale 불리언 값이 없어 상태를 판정할 수 없습니다.');
          return;
        }

        setStaleReasons(health.staleReasons);
        setLlmMode(health.llmAnswerMode ?? 'rag_only');
        if (health.stale === false) {
          setHealthState('healthy');
          setStatusReason('런타임 인덱스가 최신 상태라고 응답했습니다.');
          return;
        }
        setHealthState('stale');
        setStatusReason('런타임 인덱스에 갱신이 필요합니다.');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCheckedAt(new Date().toISOString());
        setHealthState('error');
        setStatusReason(error instanceof Error ? error.message : '상태 확인 중 알 수 없는 오류가 발생했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meta = wikiUxMeta;
  const modeLabel = llmMode === 'llm' ? 'LLM Answer' : 'RAG-only';
  const searchGeneratedDate = meta.search.generatedAt.slice(0, 10);
  const ragGeneratedDate = meta.rag.indexGeneratedAt.slice(0, 10);
  const badgeClass = healthState === 'healthy'
    ? 'badge-accent'
    : healthState === 'stale'
      ? 'badge-warning'
      : healthState === 'error'
        ? 'badge-danger'
        : 'badge-neutral';

  return (
    <header className="statusHeader header-h" role="banner">
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
          <span className={`badge ${badgeClass}`}>런타임 · {HEALTH_LABELS[healthState]} · {modeLabel}</span>
          {checkedAt ? <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleTimeString('ko-KR')} 확인</time> : null}
          <p className="statusReason">{statusReason}</p>
          {staleReasons.length > 0 ? (
            <ul className="staleReasons">{staleReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          ) : null}
        </div>
        <p className="buildFacts">
          <strong>빌드 시점</strong> · 검색 {meta.search.documentCount}개 ({meta.search.source}, {searchGeneratedDate}) · RAG {meta.rag.documentCount}개/{meta.rag.chunkCount}청크 ({ragGeneratedDate})
        </p>
      </div>
    </header>
  );
}
