import { useState } from 'react';
import { clearWikiAccessKey, setWikiAccessKey } from '../lib/wikiAccessKey';

type AccessGateProps = {
  readonly onAuthed: () => void;
};

export function AccessGate({ onAuthed }: AccessGateProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError('키를 입력하세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      });
      if (res.status === 200) {
        setWikiAccessKey(trimmed);
        onAuthed();
        return;
      }
      if (res.status === 401) {
        setError('잘못된 접근 키입니다.');
        clearWikiAccessKey();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError((data && (data.error || data.message)) || `인증 실패 (${res.status})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="accessGate" role="dialog" aria-modal="true" aria-label="접근 키 입력">
      <div className="accessGateCard">
        <h2>Wiki 접근</h2>
        <p className="hint">이 Wiki는 보호되어 있습니다. 접근 키를 입력하세요.</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="WIKI_ACCESS_KEY"
            aria-label="접근 키"
            autoFocus
            disabled={loading}
          />
          <button type="submit" disabled={loading || !key.trim()}>
            {loading ? '확인 중…' : '접속'}
          </button>
        </form>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
