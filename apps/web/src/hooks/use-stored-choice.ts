'use client';

import { useCallback, useSyncExternalStore } from 'react';

type ChoiceStorage = Pick<Storage, 'getItem' | 'setItem'>;

const CHANGE_EVENT = 'tutorio:stored-choice';

/** The stored value when it is still one of the choices, else the fallback. */
export function storedChoice<T extends string>(
  raw: string | null,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.includes(raw as T) ? (raw as T) : fallback;
}

/**
 * Reads and writes one browser-remembered choice. Storage can be missing or
 * throw (private mode, blocked site data); then a choice made in this tab is
 * kept in memory instead, so the control still switches — it just is not
 * remembered after a reload.
 */
export function createChoiceStore(storage: () => ChoiceStorage | undefined) {
  const memory = new Map<string, string>();
  return {
    read(key: string): string | null {
      if (memory.has(key)) return memory.get(key) ?? null;
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    write(key: string, value: string) {
      try {
        const target = storage();
        if (!target) throw new Error('No storage');
        target.setItem(key, value);
        memory.delete(key);
      } catch {
        // Remembering the choice is a convenience, never a requirement.
        memory.set(key, value);
      }
    },
    /** Another tab wrote the key: its stored value wins over this tab's. */
    forget(key: string) {
      memory.delete(key);
    },
  };
}

const store = createChoiceStore(() =>
  typeof window === 'undefined' ? undefined : window.localStorage,
);

/**
 * A per-browser UI choice (such as cards or rows) that survives a reload.
 * The server render and the first client render use the fallback, so the
 * page hydrates without a mismatch; the remembered choice applies right
 * after. Other tabs follow a change through the `storage` event.
 */
export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        store.forget(key);
        onChange();
      };
      const onLocal = (event: Event) => {
        if ((event as CustomEvent<string>).detail === key) onChange();
      };
      window.addEventListener('storage', onStorage);
      window.addEventListener(CHANGE_EVENT, onLocal);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(CHANGE_EVENT, onLocal);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => store.read(key),
    () => null,
  );
  const setChoice = useCallback(
    (next: T) => {
      store.write(key, next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
    },
    [key],
  );
  return [storedChoice(raw, choices, fallback), setChoice];
}
