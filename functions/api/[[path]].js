import { notFound } from '../../src/lib/pagesApiDispatch.mjs';

export function onRequest() {
  return notFound();
}
