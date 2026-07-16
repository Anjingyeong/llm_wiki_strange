export const WIKI_ACCESS_KEY_STORAGE = 'wiki_access_key';

export function getWikiAccessKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(WIKI_ACCESS_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setWikiAccessKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WIKI_ACCESS_KEY_STORAGE, key);
  } catch {
    // ignore storage errors
  }
}

export function clearWikiAccessKey(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(WIKI_ACCESS_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export function hasWikiAccessKey(): boolean {
  return !!getWikiAccessKey();
}
