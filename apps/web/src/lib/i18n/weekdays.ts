'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

// Weekday indices follow the JS convention shared with @tutorio/domain
// expandSeries: 0 = Sunday … 6 = Saturday.
export const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

// 2024-01-07 is a Sunday, so adding the index lands on that weekday.
const SUNDAY_UTC = Date.UTC(2024, 0, 7);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Localized weekday names indexed 0=Sun … 6=Sat.
 *
 * Derived from `Intl` rather than a translated list, so the product never keeps
 * seven day names per locale in its message catalogue.
 */
export function useWeekdayLabels(style: 'short' | 'long' = 'short'): string[] {
  const locale = useLocale();
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: style });
    return WEEKDAY_INDICES.map((index) =>
      format.format(new Date(SUNDAY_UTC + index * DAY_MS)),
    );
  }, [locale, style]);
}
