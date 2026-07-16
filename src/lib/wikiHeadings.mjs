/**
 * Shared, occurrence-aware heading ID allocation.
 * Keep this module free of UI dependencies so document parsing, rendering, search,
 * and RAG indexing can allocate the same stable IDs.
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function headingBaseId(text) {
  const normalized = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'section';
}

/**
 * @returns {{ allocate: (text: string) => string }}
 */
export function createHeadingIdAllocator() {
  const occupied = new Set();
  const nextOccurrence = new Map();

  return {
    allocate(text) {
      const base = headingBaseId(text);
      let occurrence = (nextOccurrence.get(base) ?? 0) + 1;
      let id = occurrence === 1 ? base : `${base}-${occurrence}`;

      while (occupied.has(id)) {
        occurrence += 1;
        id = `${base}-${occurrence}`;
      }

      occupied.add(id);
      nextOccurrence.set(base, occurrence);
      return id;
    },
  };
}

/**
 * Allocate IDs in source order without mutating the input heading records.
 *
 * @template {{ text: string }} T
 * @param {readonly T[]} headings
 * @returns {(T & { id: string })[]}
 */
export function allocateHeadingIds(headings) {
  const allocator = createHeadingIdAllocator();
  return headings.map((heading) => ({ ...heading, id: allocator.allocate(heading.text) }));
}
