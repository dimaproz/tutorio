'use client';

import { useMemo } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ScheduleResponse } from '@tutorio/validation';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { formatMoneyCompact } from '@/lib/money';
import { capitalizeFirst } from '@/lib/utils';

const mondayFirst = (weekday: number) => (weekday + 6) % 7;

/** The dates, money and schedule shapes of the learning block and its dialogs. */
export function useLearningFormat() {
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations('students.learningBlock');
  const days = useWeekdayLabels();

  return useMemo(() => {
    const money = (amountMinor: number, currency: string) =>
      formatMoneyCompact(amountMinor, currency, locale).text;
    /** "30 жовт." */
    const shortDay = (value: string | Date) =>
      format.dateTime(new Date(value), { day: 'numeric', month: 'short' });
    /** "пн 21 вер." */
    const weekdayDay = (value: string | Date) =>
      format.dateTime(new Date(value), { weekday: 'short', day: 'numeric', month: 'short' });

    return {
      money,
      /** The figure and the sign apart, for a big amount with a smaller sign. */
      moneyParts: (amountMinor: number, currency: string) =>
        formatMoneyCompact(amountMinor, currency, locale),
      /** "−1 000 ₴" / "+240 zł": a balance with its sign. */
      signedMoney: (amountMinor: number, currency: string) =>
        `${amountMinor < 0 ? '−' : amountMinor > 0 ? '+' : ''}${money(Math.abs(amountMinor), currency)}`,
      shortDay,
      weekdayDay,
      /** "пт, 25.09.2026" — a date field. */
      field: (date: Date) =>
        format.dateTime(date, {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      /** "English і B1 English". */
      list: (values: readonly string[]) => format.list(values, { type: 'conjunction' }),
      /** "1–14 жовтня": a span of days. */
      dayRange: (from: string | Date, to: string | Date) =>
        format.dateTimeRange(new Date(from), new Date(to), { day: 'numeric', month: 'long' }),
      /** "14 жовтня". */
      dayMonth: (value: string | Date) =>
        format.dateTime(new Date(value), { day: 'numeric', month: 'long' }),
      /** "пн 21 і ср 23 вер" — a short list of lesson dates. */
      dateList: (values: readonly string[]) =>
        format.list(values.map(weekdayDay), { type: 'conjunction' }),
      /** "вересень 2026" as a list heading. */
      monthYear: (value: Date) =>
        capitalizeFirst(format.dateTime(value, { month: 'long', year: 'numeric' })),
      /** A schedule's days and time: «Пн і Пт · 17:00», or «Пн 17:00 · Пт 18:30». */
      scheduleDays: (schedule: ScheduleResponse) => {
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
      /** «по 60 хв · наступне пт 25 вер». */
      scheduleDetail: (schedule: ScheduleResponse) =>
        schedule.nextLessonAt
          ? t('scheduleNext', {
              minutes: schedule.durationMin,
              next: weekdayDay(schedule.nextLessonAt),
            })
          : t('scheduleLength', { minutes: schedule.durationMin }),
    };
  }, [format, locale, t, days]);
}

export type LearningFormat = ReturnType<typeof useLearningFormat>;
