export function resolveDisplayTitle(document = {}) {
  for (const value of [
    document.displayTitle,
    document.navTitle,
    document.shortTitle,
    document.title,
    document.slug,
  ]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}
