import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const DESKTOP_BREAKPOINT = 1024;
const BELOW_DESKTOP_MEDIA_QUERY = `(max-width: ${DESKTOP_BREAKPOINT - 1}px)`;

function subscribeBelowDesktop(onStoreChange: () => void) {
  const mql = window.matchMedia(BELOW_DESKTOP_MEDIA_QUERY);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

/** Narrower than a desktop (`lg`): a tablet beside the sidebar, or a phone. */
export function useIsBelowDesktop() {
  return React.useSyncExternalStore(
    subscribeBelowDesktop,
    () => window.matchMedia(BELOW_DESKTOP_MEDIA_QUERY).matches,
    getServerSnapshot,
  );
}
