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

export function StatusHeader({ onMenuClick, title = 'LLM Wiki' }: StatusHeaderProps) {
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/rag/health', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === 'object') {
          setHealth({
            stale: typeof data.stale === 'boolean' ? data.stale : undefined,
            staleReasons: Array.isArray(data.staleReasons) ? data.staleReasons : undefined,
            llmAnswerMode: typeof data.llmAnswerMode === 'string' ? data.llmAnswerMode : undefined,
          });
        }
      })
      .catch(() => {
        /* ignore fetch errors; keep static meta */
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
  const modeLabel = llmMode === 'llm' ? 'llm' : 'rag';

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
      <div className="statusHeaderStatus">
        <span
          className={`badge ${isStale ? 'badge-warning' : 'badge-accent'}`}
          aria-label={isStale ? 'stale index' : 'system status'}
          title={isStale ? (health?.staleReasons ?? []).join(', ') : undefined}
        >
          {searchDocCount}/{ragDocCount}/{ragChunkCount} · {modeLabel}
        </span>
      </div>
    </header>
  );
}

