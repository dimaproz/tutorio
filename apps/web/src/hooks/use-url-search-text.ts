'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useDebouncedValue } from './use-debounced-value';

/** How long typing has to pause before a search reaches the URL. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Whether the field has to take a search that arrived in the URL. It does not
 * when the URL only caught up with what the field already shows or already
 * sent, which keeps the keystrokes typed while the last commit was on its way.
 */
export function searchTextFollowsUrl(search: string, text: string, settled: string): boolean {
  return search !== text.trim() && search !== settled.trim();
}

/**
 * The text of a URL-backed search field. The field updates on every
 * keystroke; `onCommit` runs once typing pauses, so a list reads the server
 * once per pause instead of once per key. The field still follows the URL:
 * when the search changes elsewhere (a "clear" command, back/forward) the
 * field shows the new value.
 */
export function useUrlSearchText(
  search: string | undefined,
  onCommit: (next: string) => void,
  delay = SEARCH_DEBOUNCE_MS,
): [string, (next: string) => void] {
  const [text, setText] = useState(search ?? '');
  const settled = useDebouncedValue(text, delay);
  const [seen, setSeen] = useState(search);
  // Adjusting state during render: an effect would paint the stale text first.
  if (search !== seen) {
    setSeen(search);
    if (searchTextFollowsUrl(search ?? '', text, settled)) setText(search ?? '');
  }

  const commit = useEffectEvent((value: string) => {
    if (value.trim() !== (search ?? '')) onCommit(value);
  });
  useEffect(() => {
    commit(settled);
  }, [settled]);

  return [text, setText];
}
