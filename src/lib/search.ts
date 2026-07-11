import { searchIndex } from '../generated/searchIndex';
import { searchDocumentsInIndex } from './searchCore.mjs';
import type { SearchResult } from './types';

export {
  expandTokenVariants,
  normalizeSearchText,
  searchDocumentsInIndex,
  scoreSearchDocument,
  tokenizeQuery,
} from './searchCore.mjs';

const DEFAULT_LIMIT = 12;

/**
 * Client document search (not RAG). Uses generated searchIndex.
 */
export function searchDocuments(
  query: string,
  options?: { readonly limit?: number },
): readonly SearchResult[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  return searchDocumentsInIndex(searchIndex as readonly object[], query, {
    limit,
  }) as unknown as SearchResult[];
}
