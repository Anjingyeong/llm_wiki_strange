import { searchIndex } from '../generated/searchIndex';
import type { SearchResult } from './types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreDocument(query: string, document: { readonly title: string; readonly summary?: string; readonly tags: readonly string[]; readonly updatedAt: string }, haystack: string): number {
  if (!query) {
    return 0;
  }
  let score = 0;
  for (const token of query.split(/\s+/).filter(Boolean)) {
    if (normalize(document.title).includes(token)) {
      score += 8;
    }
    if (document.summary && normalize(document.summary).includes(token)) {
      score += 4;
    }
    if (document.tags.some((tag) => normalize(tag).includes(token))) {
      score += 3;
    }
    if (document.updatedAt.includes(token)) {
      score += 2;
    }
    const matches = haystack.split(token).length - 1;
    score += matches;
  }
  return score;
}

export function searchDocuments(query: string): readonly SearchResult[] {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  return searchIndex
    .map((document) => {
      const haystack = normalize(
        `${document.title} ${document.summary ?? ''} ${document.category} ${document.tags.join(' ')} ${document.updatedAt} ${document.text}`,
      );
      return { ...document, score: scoreDocument(normalized, document, haystack) };
    })
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 8);
}
