'use client';

import { useMemo } from 'react';
import { enUS, uk, type Locale } from 'date-fns/locale';
import { useLocale } from 'next-intl';

// date-fns needs its own locale object; next-intl only hands us the tag. One
// mapping for the whole app, so adding a product locale is a one-line change.
const DATE_FNS_LOCALES: Record<string, Locale> = { uk, en: enUS };

/** The date-fns locale matching the active product locale. */
export function useDateFnsLocale(): Locale {
  const locale = useLocale();
  return DATE_FNS_LOCALES[locale] ?? enUS;
}

/**
 * Locale-aware date/time formatters, memoized per locale.
 *
 * `Intl.DateTimeFormat` construction is not free and its option sets are
 * product decisions, not per-component ones — so the four shapes the product
 * actually uses live here instead of being re-declared in every detail page.
 */
export interface DateTimeFormatters {
  /** "14:30" — a lesson slot in a list. */
  time: (value: Date | string) => string;
  /** "3 Aug" — compact, for dense rows. */
  dayMonth: (value: Date | string) => string;
  /** "3 Aug, 14:30" — a row that needs both. */
  dayMonthTime: (value: Date | string) => string;
  /** "3 August 2026" — a profile's "added on" line. */
  longDate: (value: Date | string) => string;
  /** "Monday, 3 August" — a section heading for one day. */
  weekdayLongDate: (value: Date | string) => string;
}

const asDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

export function useDateFormatters(): DateTimeFormatters {
  const locale = useLocale();

  return useMemo(() => {
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dayMonth = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    });
    const dayMonthTime = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const longDate = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const weekdayLongDate = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return {
      time: (value) => time.format(asDate(value)),
      dayMonth: (value) => dayMonth.format(asDate(value)),
      dayMonthTime: (value) => dayMonthTime.format(asDate(value)),
      longDate: (value) => longDate.format(asDate(value)),
      weekdayLongDate: (value) => weekdayLongDate.format(asDate(value)),
    };
  }, [locale]);
}
