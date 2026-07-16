import React, { useEffect, useState } from 'react';

import { wikiUxMeta } from '../generated/wikiUxMeta';

type StatusHeaderProps = {
  readonly onMenuClick?: () => void;
  readonly title?: string;
};

type HealthInfo = {
  readonly stale?: boolean;
  readonly staleReasons?: string[];
  readonly llmAnswerMode?: string;
};

export function StatusHeader({ onMenuClick, title = 'Smart Safety AI Wiki' }: StatusHeaderProps) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setHealthError(false);
    fetch('/api/rag/health', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === 'object') {
          setHealth({
            stale: typeof data.stale === 'boolean' ? data.stale : undefined,
            staleReasons: Array.isArray(data.staleReasons) ? data.staleReasons : undefined,
            llmAnswerMode: typeof data.llmAnswerMode === 'string' ? data.llmAnswerMode : undefined,
          });
        } else if (!cancelled) {
          setHealthError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meta = wikiUxMeta;
  const searchDocCount = meta.searchDocCount ?? meta.search?.documentCount ?? 0;
  const ragDocCount = meta.rag?.documentCount ?? 0;
  const ragChunkCount = meta.rag?.chunkCount ?? 0;

  const isStale = health?.stale === true;
  const llmMode = health?.llmAnswerMode ?? 'rag_only';
  const modeLabel = llmMode === 'llm' ? 'LLM Answer' : 'RAG-only';

  return (
    <header className="statusHeader header-h" role="banner">
      <button
        type="button"
        className="mobileMenuBtn"
        onClick={onMenuClick}
        aria-label="사이드바 메뉴 열기"
      >
        ☰
      </button>
      <div className="statusHeaderTitle">{title}</div>
      <div className="statusHeaderSubtitle" style={{ fontSize: '0.85em', opacity: 0.85, marginTop: '-2px' }}>실시간 영상관제 시스템의 설계·실험·운영 근거</div>
      <div className="statusHeaderStatus">
        {healthError ? (
          <span className="badge badge-danger" aria-label="server status unknown">서버 상태 확인 불가</span>
        ) : (
          <span
            className={`badge ${isStale ? 'badge-warning' : 'badge-accent'}`}
            aria-label={isStale ? 'stale index' : 'system status'}
            title={isStale ? (health?.staleReasons ?? []).join(', ') : undefined}
          >
            검색 {searchDocCount} · RAG {ragDocCount} · 청크 {ragChunkCount} · {modeLabel}
          </span>
        )}
      </div>
    </header>
  );
}

