'use client';

import { useEffect, useState } from 'react';

/**
 * The value once it has stopped changing for `delay` ms, so a search asks the
 * server once per pause in typing rather than once per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
