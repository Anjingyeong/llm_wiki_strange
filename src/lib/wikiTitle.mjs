function firstNonEmpty(document, fields) {
  for (const field of fields) {
    const value = document?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function resolvePageTitle(document = {}) {
  return firstNonEmpty(document, ['displayTitle', 'navTitle', 'title', 'shortTitle', 'slug']);
}

export function resolveNavigationTitle(document = {}) {
  return firstNonEmpty(document, ['navTitle', 'shortTitle', 'displayTitle', 'title', 'slug']);
}

export function resolveReferenceTitle(document = {}) {
  return firstNonEmpty(document, ['shortTitle', 'navTitle', 'displayTitle', 'title', 'slug']);
}

// Backward-compatible canonical UI title used by generated indexes and search.
export function resolveDisplayTitle(document = {}) {
  return resolvePageTitle(document);
}
