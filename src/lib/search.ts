import { searchIndex } from '../generated/searchIndex';
import { NO_RESULT_THRESHOLD, searchDocumentsInIndex } from './searchCore.mjs';
import type { SearchDocument, SearchResult } from './types';

export {
  expandTokenVariants,
  NO_RESULT_THRESHOLD,
  normalizeSearchText,
  pickSectionIdFromHeadings,
  searchDocumentsInIndex,
  scoreSearchDocument,
  tokenizeQuery,
  WEAK_RESULT_MIN_SCORE,
} from './searchCore.mjs';

export const SEARCH_RESULT_LIMIT_MAX = 40;
const DEFAULT_LIMIT = 12;

/**
 * Client document search (not RAG). Uses generated searchIndex.
 * Results below NO_RESULT_THRESHOLD are omitted (empty = no result).
 */
export function searchDocuments(
  query: string,
  options?: { readonly limit?: number },
): readonly SearchResult[] {
  const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, SEARCH_RESULT_LIMIT_MAX);
  return searchDocumentsInIndex(searchIndex as readonly SearchDocument[], query, {
    limit,
    minScore: NO_RESULT_THRESHOLD,
  }) as SearchResult[];
}
