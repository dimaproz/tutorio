'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { formatMoneyCompact } from '@/lib/money';

const HOUR_MS = 3_600_000;

/** The date and time shapes the panel repeats, in the studio's locale and zone. */
export function useLessonDates() {
  const format = useFormatter();
  return {
    /** "пт, 11 вересня" — the panel title and links. */
    longDay: (iso: string) =>
      format.dateTime(new Date(iso), { weekday: 'short', day: 'numeric', month: 'long' }),
    /** "11 вересня". */
    dayMonth: (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'long' }),
    /** "11 вер" — history and short notes. */
    shortDay: (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short' }),
    /** "пт 18 вер" — lesson lists inside a sentence. */
    weekdayShort: (iso: string) =>
      format.dateTime(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' }),
    /** "пт, 11.09.2026" — the date field. */
    field: (date: Date) =>
      format.dateTime(date, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    /** "17:00". */
    time: (iso: string) => format.dateTime(new Date(iso), { hour: '2-digit', minute: '2-digit' }),
    /** The end time of a lesson. */
    endTime: (lesson: { startsAtUtc: string; durationMin: number }) =>
      format.dateTime(new Date(Date.parse(lesson.startsAtUtc) + lesson.durationMin * 60_000), {
        hour: '2-digit',
        minute: '2-digit',
      }),
  };
}

/** A span of time before a lesson: "3 год" under two days, else "2 дні". */
export function useDurationLabel() {
  const t = useTranslations('lessons.duration');
  return (ms: number) => {
    const hours = Math.max(Math.floor(ms / HOUR_MS), 0);
    return hours < 48 ? t('hours', { count: hours }) : t('days', { count: Math.floor(hours / 24) });
  };
}

/** Money as the design writes it: "4 000 ₴". */
export function useMoney() {
  const locale = useLocale();
  return (amountMinor: number, currency: string) =>
    formatMoneyCompact(amountMinor, currency, locale).text;
}

/** The figure and the sign apart, for a big amount with a smaller sign. */
export function useMoneyParts() {
  const locale = useLocale();
  return (amountMinor: number, currency: string) =>
    formatMoneyCompact(amountMinor, currency, locale);
}
