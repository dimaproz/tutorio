'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Where focus goes when a dialog opened without a trigger element closes.
 * Radix returns focus to its trigger; a dialog opened from state has none, so
 * focus would fall to the page body. This remembers what had focus when the
 * dialog opened and returns there, or to `fallback` when that element has left
 * the page (a menu item, or the row the dialog just removed).
 *
 * Pass the result as the content's `onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean, fallback?: () => HTMLElement | null) {
  const opener = useRef<HTMLElement | null>(null);

  // Layout effects run before the dialog's focus scope moves focus inside.
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
  }, [open]);

  return useCallback(
    (event: Event) => {
      const remembered = opener.current;
      const target =
        remembered?.isConnected && remembered !== document.body ? remembered : fallback?.();
      if (!target) return;
      event.preventDefault();
      target.focus();
    },
    [fallback],
  );
}
