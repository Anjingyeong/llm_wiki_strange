import { searchIndex } from '../generated/searchIndex';
import type { SearchResult } from './types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreDocument(query: string, haystack: string, title: string): number {
  if (!query) {
    return 0;
  }
  let score = 0;
  for (const token of query.split(/\s+/).filter(Boolean)) {
    if (normalize(title).includes(token)) {
      score += 8;
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
        `${document.title} ${document.category} ${document.tags.join(' ')} ${document.text}`,
      );
      return { ...document, score: scoreDocument(normalized, haystack, document.title) };
    })
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 8);
}
