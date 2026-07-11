import index from '../../../data/ragVectorIndex.json';
import { buildHealthPayload } from '../../../scripts/lib/rag/index-meta.mjs';

export async function onRequestGet() {
  const payload = buildHealthPayload(index);
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
