'use client';

import { useLocalFormatter } from '@/lib/i18n/local-formatter';

/**
 * The dates the schedule dialogs name, in the browser's zone: a list in one
 * month as «пт 2 · 9 · 23 жовтня», across months as «30 вер · 2 жовт», and
 * one lesson as «пт 9 жовтня» or «чт 8 жовтня · 16:00».
 */
export function useScheduleDates() {
  const format = useLocalFormatter();
  const weekday = (date: Date) => format.dateTime(date, { weekday: 'short' });
  const dayMonth = (date: Date) => format.dateTime(date, { day: 'numeric', month: 'long' });
  return {
    /** «пт 9 жовтня». */
    day: (iso: string) => `${weekday(new Date(iso))} ${dayMonth(new Date(iso))}`,
    /** «пт 25 вер». */
    dayShort: (iso: string) => {
      const date = new Date(iso);
      return `${weekday(date)} ${format
        .dateTime(date, { day: 'numeric', month: 'short' })
        .replace(/\.$/, '')}`;
    },
    /** «чт 8 жовтня · 16:00». */
    dayTime: (iso: string) =>
      `${weekday(new Date(iso))} ${dayMonth(new Date(iso))} · ${format.time(Date.parse(iso))}`,
    /** «1 жовтня». */
    dayMonth: (iso: string) => dayMonth(new Date(iso)),
    /** Several dates, shortest first, at most `max` of them. */
    list: (isos: readonly string[], max = 6) => {
      const dates = [...isos].sort().map((iso) => new Date(iso));
      if (dates.length === 0) return '';
      const shown = dates.slice(0, max);
      const more = dates.length > max ? ' …' : '';
      const sameMonth = shown.every(
        (date) =>
          date.getMonth() === shown[0]!.getMonth() &&
          date.getFullYear() === shown[0]!.getFullYear(),
      );
      if (sameMonth) {
        const oneWeekday = shown.every((date) => date.getDay() === shown[0]!.getDay());
        const days = shown.slice(0, -1).map((date) => String(date.getDate()));
        const tail = dayMonth(shown.at(-1)!);
        return `${oneWeekday ? `${weekday(shown[0]!)} ` : ''}${[...days, tail].join(' · ')}${more}`;
      }
      return (
        shown
          .map((date) =>
            format.dateTime(date, { day: 'numeric', month: 'short' }).replace(/\.$/, ''),
          )
          .join(' · ') + more
      );
    },
  };
}
