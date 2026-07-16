import { answerQuestionFromIndex } from '../../../scripts/lib/rag/answer.mjs';
import { json, methodDispatcher } from '../../../src/lib/pagesApiDispatch.mjs';

export function onRequest(context) {
  const env = (context && context.env) || {};
  return methodDispatcher(context.request, {
    method: 'POST',
    onKnownMethod: (req) => onRequestPost({ ...context, request: req, env }),
  });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const accessKey = env.WIKI_ACCESS_KEY;
  if (accessKey) {
    const headerKey = context.request.headers.get('x-wiki-key') || '';
    if (headerKey !== accessKey) {
      return json({ error: 'unauthorized' }, 401);
    }
  }
  try {
    const body = await context.request.json().catch(() => ({}));
    const question = typeof body?.question === 'string' ? body.question : '';
    const debug = body?.debug === true || env.RAG_DEBUG === 'true';
    const index = await loadIndex(env);
    const result = await answerQuestionFromIndex(index, question, { debug, env });
    return json(result, 200);
  } catch (e) {
    return json({ status: 'error', answer: 'RAG 처리 중 오류', sources: [] }, 500);
  }
}

async function loadIndex(env) {
  // In Pages the index is bundled or fetched from static; for contract use dynamic import when possible
  // Fallback to import from data path if available in build
  try {
    // @ts-ignore - runtime
    const mod = await import('../../../data/ragVectorIndex.json', { assert: { type: 'json' } });
    return mod.default || mod;
  } catch {
    // Pages functions can read from static asset in some runtimes; try fetch relative
    const res = await fetch('/data/ragVectorIndex.json');
    if (res.ok) return res.json();
    throw new Error('index not available');
  }
}
