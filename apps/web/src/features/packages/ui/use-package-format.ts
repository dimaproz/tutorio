'use client';

import { useMemo } from 'react';
import { useFormatter, useLocale } from 'next-intl';
import type { ScheduleResponse } from '@tutorio/validation';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { formatMoneyCompact } from '@/lib/money';
import { capitalizeFirst } from '@/lib/utils';

const mondayFirst = (weekday: number) => (weekday + 6) % 7;

/** The money, dates and schedule shapes of the package screens. */
export function usePackageFormat() {
  const format = useFormatter();
  const locale = useLocale();
  const days = useWeekdayLabels();

  return useMemo(() => {
    const money = (amountMinor: number, currency: string) =>
      formatMoneyCompact(amountMinor, currency, locale).text;
    return {
      money,
      /** The figure and the sign apart, for a big amount with a smaller sign. */
      moneyParts: (amountMinor: number, currency: string) =>
        formatMoneyCompact(amountMinor, currency, locale),
      /** The currency sign alone, for a field suffix. */
      symbol: (currency: string) => formatMoneyCompact(0, currency, locale).symbol,
      /** "30 жовт": a short date without the month's period. */
      shortDay: (value: string | Date) =>
        format.dateTime(new Date(value), { day: 'numeric', month: 'short' }).replace(/\.$/, ''),
      /** "30 жовтня". */
      dayMonth: (value: string | Date) =>
        format.dateTime(new Date(value), { day: 'numeric', month: 'long' }),
      /** "пн 28 вересня". */
      weekdayDayMonth: (value: string | Date) =>
        format.dateTime(new Date(value), { weekday: 'short', day: 'numeric', month: 'long' }),
      /** "1–31 жовтня". */
      dayRange: (from: string | Date, to: string | Date) =>
        format.dateTimeRange(new Date(from), new Date(to), { day: 'numeric', month: 'long' }),
      /** "1–31 жовт". */
      shortRange: (from: string | Date, to: string | Date) =>
        format
          .dateTimeRange(new Date(from), new Date(to), { day: 'numeric', month: 'short' })
          .replace(/\.$/, ''),
      /** "пт, 30.10.2026" — a date field. */
      field: (date: Date) =>
        format.dateTime(date, {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      /** "17:00". */
      time: (value: string | Date) =>
        format.dateTime(new Date(value), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      /** "ЧТ" and "24" for a date tile. */
      tile: (value: string | Date) => {
        const date = new Date(value);
        return {
          top: format.dateTime(date, { weekday: 'short' }).toLocaleUpperCase(locale),
          day: String(date.getDate()),
        };
      },
      /** "вер." — the month of a lesson row. */
      month: (value: string | Date) => format.dateTime(new Date(value), { month: 'short' }),
      /** A schedule's days and time: «Пн і Пт · 17:00», or «Пн 17:00 · Пт 18:30». */
      scheduleDays: (schedule: Pick<ScheduleResponse, 'slots'>) => {
        const slots = [...schedule.slots].sort(
          (a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday),
        );
        const name = (weekday: number) => capitalizeFirst(days[weekday] ?? '');
        const times = new Set(slots.map((slot) => slot.localTime));
        return times.size === 1
          ? `${format.list(
              slots.map((slot) => name(slot.weekday)),
              { type: 'conjunction' },
            )} · ${slots[0]?.localTime ?? ''}`
          : slots.map((slot) => `${name(slot.weekday)} ${slot.localTime}`).join(' · ');
      },
      /** "Пн і Пт" — the schedule's days alone. */
      scheduleWeekdays: (schedule: Pick<ScheduleResponse, 'slots'>) =>
        format.list(
          [...schedule.slots]
            .sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday))
            .map((slot) => capitalizeFirst(days[slot.weekday] ?? '')),
          { type: 'conjunction' },
        ),
    };
  }, [format, locale, days]);
}

export type PackageFormat = ReturnType<typeof usePackageFormat>;
