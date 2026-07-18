import { useCallback, useEffect, useRef, useState } from 'react';

export function useMobileWikiNavigation(sidebarId: string) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileNav = useCallback(() => {
    if (!mobileNavOpen) return;
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, [mobileNavOpen]);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(sidebarId)
        ?.querySelector<HTMLElement>('button:not([disabled])')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileNavOpen, sidebarId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileNavOpen) {
        closeMobileNav();
        return;
      }

      if (e.key !== 'Tab' || !mobileNavOpen) return;
      const sidebar = document.getElementById(sidebarId);
      if (!sidebar) return;

      const focusableElements = Array.from(
        sidebar.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
      ).filter((element) => element.offsetParent !== null);
      const firstFocusable = focusableElements.at(0);
      const lastFocusable = focusableElements.at(-1);
      if (!firstFocusable || !lastFocusable) return;

      const activeElement = document.activeElement;
      if (e.shiftKey) {
        if (activeElement === firstFocusable || !sidebar.contains(activeElement)) {
          e.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (activeElement === lastFocusable || !sidebar.contains(activeElement)) {
        e.preventDefault();
        firstFocusable.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMobileNav, mobileNavOpen, sidebarId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileNavOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  return { closeMobileNav, mobileMenuButtonRef, mobileNavOpen, openMobileNav } as const;
}
