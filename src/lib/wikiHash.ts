/** SPA routes: #/Slug, #/Slug/section-id, #/__search__, #/__rag__ */

export type WikiView = 'doc' | 'search' | 'rag';

export function parseLocationHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): {
  view: WikiView;
  slug: string;
  sectionId: string | null;
} {
  const raw = hash.replace(/^#\/?/, '').trim();
  if (!raw) return { view: 'doc', slug: '', sectionId: null };

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  if (decoded === '__search__' || decoded === '__search') {
    return { view: 'search', slug: '', sectionId: null };
  }
  if (decoded === '__rag__' || decoded === '__rag') {
    return { view: 'rag', slug: '', sectionId: null };
  }

  const slash = decoded.indexOf('/');
  if (slash === -1) {
    return { view: 'doc', slug: decoded, sectionId: null };
  }
  const slug = decoded.slice(0, slash);
  const sectionId = decoded.slice(slash + 1) || null;
  return { view: 'doc', slug, sectionId };
}

export function writeDocumentHash(slug: string, sectionId?: string | null) {
  const encSlug = encodeURIComponent(slug);
  const hash = sectionId
    ? `#/${encSlug}/${encodeURIComponent(sectionId)}`
    : `#/${encSlug}`;
  window.location.hash = hash;
}

export function writeViewHash(view: Exclude<WikiView, 'doc'>) {
  window.location.hash = view === 'search' ? '#/__search__' : '#/__rag__';
}

export function wikiLink(slug: string, sectionId?: string | null): string {
  const encSlug = encodeURIComponent(slug);
  if (sectionId) return `#/${encSlug}/${encodeURIComponent(sectionId)}`;
  return `#/${encSlug}`;
}