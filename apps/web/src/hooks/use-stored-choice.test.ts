import { describe, expect, it } from 'vitest';
import { createChoiceStore, storedChoice } from './use-stored-choice';

const VIEWS = ['grid', 'rows'] as const;

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('storedChoice', () => {
  it('keeps a stored value that is still a choice', () => {
    expect(storedChoice('rows', VIEWS, 'grid')).toBe('rows');
  });

  it('falls back on nothing stored or a value no longer offered', () => {
    expect(storedChoice(null, VIEWS, 'grid')).toBe('grid');
    expect(storedChoice('table', VIEWS, 'grid')).toBe('grid');
  });
});

describe('createChoiceStore', () => {
  it('remembers a choice in browser storage', () => {
    const storage = fakeStorage();
    const store = createChoiceStore(() => storage);
    store.write('groups.view', 'rows');
    expect(storage.data.get('groups.view')).toBe('rows');
    // A fresh page reads it back from storage.
    expect(createChoiceStore(() => storage).read('groups.view')).toBe('rows');
  });

  it('still switches in this tab when storage throws', () => {
    const store = createChoiceStore(() => ({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    }));
    expect(store.read('groups.view')).toBeNull();
    store.write('groups.view', 'rows');
    expect(store.read('groups.view')).toBe('rows');
  });

  it('reads what another tab stored', () => {
    const storage = fakeStorage();
    const store = createChoiceStore(() => storage);
    store.write('groups.view', 'rows');
    storage.data.set('groups.view', 'grid');
    expect(store.read('groups.view')).toBe('grid');
  });
});
