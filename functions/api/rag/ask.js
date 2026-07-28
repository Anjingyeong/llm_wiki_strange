import { answerQuestionFromIndex } from '../../../scripts/lib/rag/answer.mjs';
import { json, methodDispatcher } from '../../../src/lib/pagesApiDispatch.mjs';
import { enrichAnswerResultWithMetadata } from '../../lib/rag-metadata.js';

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
    const enrichedResult = await enrichAnswerResultWithMetadata(env, index, result);
    return json(enrichedResult, 200);
  } catch (error) {
    const isDebug = env.RAG_DEBUG === 'true';
    const displayMessage = isDebug
      ? 'RAG API 처리 중 오류가 발생했습니다: ' + error.message
      : 'RAG API 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    return json({ status: 'error', answer: displayMessage, sources: [] }, 500);
  }
}

async function loadIndex(env) {
  try {
    // @ts-ignore - runtime
    const mod = await import('../../../data/ragVectorIndex.json', { assert: { type: 'json' } });
    return mod.default || mod;
  } catch {
    const res = await fetch('/data/ragVectorIndex.json');
    if (res.ok) return res.json();
    throw new Error('index not available');
  }
}
