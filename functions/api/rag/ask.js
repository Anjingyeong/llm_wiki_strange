import { answerQuestionFromIndex } from '../../../scripts/lib/rag-core.mjs';
import index from '../../../data/ragVectorIndex.json';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const question = typeof body.question === 'string' ? body.question : '';
    const debug = body.debug === true || context.env?.RAG_DEBUG === 'true';

    const result = await answerQuestionFromIndex(index, question, {
      env: context.env,
      debug,
    });

    return new Response(JSON.stringify(result), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        answer: 'RAG API 처리 중 오류가 발생했습니다: ' + error.message,
        sources: [],
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  }
}
