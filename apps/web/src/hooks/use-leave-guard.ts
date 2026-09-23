'use client';

import { useEffect, useRef } from 'react';

/**
 * Warns before a page with unsaved changes is left. The browser's own prompt
 * covers reloads and closing the tab; with `onNavigate`, an in-app link (the
 * sidebar, the tab bar, a breadcrumb) is held back and handed to the caller,
 * which asks first and navigates only on confirmation.
 */
export function useLeaveGuard(active: boolean, onNavigate?: (href: string) => void) {
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Capture on the document runs before React's own listener on the root,
    // so a Next <Link> never starts its client navigation.
    const onClick = (event: MouseEvent) => {
      const handler = onNavigateRef.current;
      if (!handler || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handler(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);
}
