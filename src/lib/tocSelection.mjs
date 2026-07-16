/** The viewport offset reserved for the fixed application header. */
export const TOC_TOP_ANCHOR_PX = 96;

/**
 * Select the heading currently at (or most recently above) the top anchor.
 * Positions are viewport-relative and must be supplied in document order.
 *
 * @param {readonly { id: string, top: number }[]} positions
 * @param {number} [topAnchor]
 * @returns {string | null}
 */
export function selectTocHeadingId(positions, topAnchor = TOC_TOP_ANCHOR_PX) {
  if (!positions.length) return null;

  let activeId = positions[0].id;
  for (const position of positions) {
    if (position.top > topAnchor) break;
    activeId = position.id;
  }
  return activeId;
}

/**
 * Return the page scroll position which places an element at the TOC anchor.
 *
 * @param {number} elementTop viewport-relative element top
 * @param {number} scrollY current page scroll position
 * @param {number} [topAnchor]
 * @returns {number}
 */
export function scrollTopForTocAnchor(elementTop, scrollY, topAnchor = TOC_TOP_ANCHOR_PX) {
  return Math.max(0, scrollY + elementTop - topAnchor);
}
