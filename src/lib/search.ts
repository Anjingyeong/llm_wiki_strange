import { searchIndex } from '../generated/searchIndex';
import { getDisplayTitle, type SearchDocument, type SearchResult } from './types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreDocument(query: string, document: SearchDocument, haystack: string): number {
  if (!query) {
    return 0;
  }
  let score = 0;
  const displayTitle = normalize(getDisplayTitle(document));
  if (displayTitle === query) {
    score += 30;
  } else if (displayTitle.includes(query)) {
    score += 18;
  }
  if (normalize(document.title).includes(query)) {
    score += 10;
  }
  for (const token of query.split(/\s+/).filter(Boolean)) {
    if (normalize(document.title).includes(token)) {
      score += 8;
    }
    if (document.navTitle && normalize(document.navTitle).includes(token)) {
      score += 8;
    }
    if (document.shortTitle && normalize(document.shortTitle).includes(token)) {
      score += 6;
    }
    if (document.slug && normalize(document.slug).includes(token)) {
      score += 5;
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
        `${document.title} ${document.navTitle ?? ''} ${document.shortTitle ?? ''} ${document.slug} ${document.summary ?? ''} ${document.category} ${document.tags.join(' ')} ${document.updatedAt} ${document.text}`,
      );
      return { ...document, score: scoreDocument(normalized, document, haystack) };
    })
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score || getDisplayTitle(left).localeCompare(getDisplayTitle(right)))
    .slice(0, 8);
}
