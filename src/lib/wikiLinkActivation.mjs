/**
 * @param {{ button: number, defaultPrevented: boolean, altKey: boolean, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean }} event
 * @returns {boolean}
 */
export function shouldHandleWikiLinkClick(event) {
  return event.button === 0
    && !event.defaultPrevented
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey;
}
