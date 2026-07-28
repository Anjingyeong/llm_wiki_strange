import { searchHybridForUi } from '../../../scripts/lib/rag/search-api.mjs';
import index from '../../../data/ragVectorIndex.json';
import { enrichSearchPayloadWithMetadata } from '../../lib/rag-metadata.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const query =
      typeof body.query === 'string'
        ? body.query
        : typeof body.question === 'string'
          ? body.question
          : '';
    const limit = Number.isFinite(body.limit) ? body.limit : 12;
    const debug = body.debug === true || context.env?.RAG_DEBUG === 'true';

    const payload = searchHybridForUi(index, query, {
      limit,
      debug,
      env: context.env,
    });
    const enrichedPayload = await enrichSearchPayloadWithMetadata(
      context.env,
      index,
      payload,
    );

    return new Response(JSON.stringify(enrichedPayload), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const isDebug = context.env?.RAG_DEBUG === 'true';
    return new Response(
      JSON.stringify({
        status: 'error',
        error: isDebug ? String(error?.message || error) : 'search_failed',
        results: [],
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  }
}
