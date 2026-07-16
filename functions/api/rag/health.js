import { buildHealthPayload } from '../../../scripts/lib/rag/index-meta.mjs';
import { json, methodDispatcher } from '../../../src/lib/pagesApiDispatch.mjs';

export function onRequest(context) {
  const env = (context && context.env) || {};
  return methodDispatcher(context.request, {
    method: 'GET',
    onKnownMethod: (req) => onRequestGet({ ...context, request: req, env }),
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  try {
    // Prefer bundled index in Pages; fall back to fetch
    let index = null;
    try {
      // @ts-ignore
      const mod = await import('../../../data/ragVectorIndex.json', { assert: { type: 'json' } });
      index = mod.default || mod;
    } catch {
      const res = await fetch('/data/ragVectorIndex.json');
      if (res.ok) index = await res.json();
    }
    const payload = buildHealthPayload(index || { chunks: [] }, {
      expectedCorpusHash: (index && index.corpusHash) || null,
      env,
    });
    return json(payload, 200);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}
