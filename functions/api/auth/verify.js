import { json } from '../../../src/lib/pagesApiDispatch.mjs';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const provided = typeof body?.key === 'string' ? body.key : '';
    const expected = (context.env && context.env.WIKI_ACCESS_KEY) || '';
    if (!expected) {
      return json({ ok: true, accessKeyRequired: false }, 200);
    }
    if (provided && provided === expected) {
      return json({ ok: true }, 200);
    }
    return json({ error: 'unauthorized' }, 401);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
}

export function onRequest(context) {
  // delegate to method specific
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return json({ error: 'method_not_allowed' }, 405);
}
