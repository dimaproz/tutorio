'use client';

import { useMemo } from 'react';
import { enUS, uk, type Locale } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { useStudioTimeZone } from './time-zone';

// date-fns needs its own locale object; next-intl only hands us the tag. One
// mapping for the whole app, so adding a product locale is a one-line change.
const DATE_FNS_LOCALES: Record<string, Locale> = { uk, en: enUS };

/** The date-fns locale matching the active product locale. */
export function useDateFnsLocale(): Locale {
  const locale = useLocale();
  return DATE_FNS_LOCALES[locale] ?? enUS;
}

/**
 * Locale-aware date/time formatters on the studio's clock, memoized per
 * locale and zone.
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
  /** "Thu, 10 September" — a date named in a sentence. */
  weekdayDayMonth: (value: Date | string) => string;
}

const asDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

export function useDateFormatters(): DateTimeFormatters {
  const locale = useLocale();
  const timeZone = useStudioTimeZone();

  return useMemo(() => {
    const time = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    });
    const dayMonth = new Intl.DateTimeFormat(locale, {
      timeZone,
      day: 'numeric',
      month: 'short',
    });
    const dayMonthTime = new Intl.DateTimeFormat(locale, {
      timeZone,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const longDate = new Intl.DateTimeFormat(locale, {
      timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const weekdayLongDate = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const weekdayDayMonth = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });

    return {
      time: (value) => time.format(asDate(value)),
      dayMonth: (value) => dayMonth.format(asDate(value)),
      dayMonthTime: (value) => dayMonthTime.format(asDate(value)),
      longDate: (value) => longDate.format(asDate(value)),
      weekdayLongDate: (value) => weekdayLongDate.format(asDate(value)),
      weekdayDayMonth: (value) => weekdayDayMonth.format(asDate(value)),
    };
  }, [locale, timeZone]);
}
