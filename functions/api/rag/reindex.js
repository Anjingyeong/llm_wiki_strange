import { json, methodDispatcher } from '../../../src/lib/pagesApiDispatch.mjs';

export function onRequest(context) {
  return methodDispatcher(context.request, {
    method: 'POST',
    onKnownMethod: () => json({
      error: 'run npm run rag:index on the server to refresh embeddings after document edits',
    }, 405),
  });
}
