import { json } from '../../../src/lib/pagesApiDispatch.mjs';

export async function onRequestGet(context) {
  const accessKeyRequired = !!(context.env && context.env.WIKI_ACCESS_KEY);
  return json({ accessKeyRequired }, 200);
}

export function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return json({ error: 'method_not_allowed' }, 405);
}
