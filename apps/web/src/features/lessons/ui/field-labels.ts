'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { enUS, uk } from 'date-fns/locale';
import type { DateRowsLabels } from '@/components/shared/date-rows-field';
import type { DurationFieldLabels } from '@/components/shared/duration-field';
import type { TimeFieldLabels } from '@/components/shared/time-field';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { capitalizeFirst } from '@/lib/utils';

/** A length in words: the list's note ("1,5 год") and the hint's length ("1 год 30 хв"). */
export function useDurationWords() {
  const t = useTranslations('lessons.fields');
  return {
    /** The list's note after "90 хв": "1,5 год"; empty under an hour. */
    note: (minutes: number) => {
      if (minutes < 60) return '';
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      if (rest === 0) return t('hoursWhole', { hours });
      if (rest === 30) return t('hoursHalf', { hours });
      return t('hoursMinutes', { hours, minutes: rest });
    },
    /** The hint's length: "1 год 30 хв", "45 хв". */
    length: (minutes: number) => {
      if (minutes < 60) return t('minutes', { count: minutes });
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest === 0 ? t('hoursWhole', { hours }) : t('hoursMinutes', { hours, minutes: rest });
    },
  };
}

/** The duration field's copy. */
export function useDurationLabels(): DurationFieldLabels {
  const t = useTranslations('lessons.fields');
  const words = useDurationWords();
  return {
    unit: t('unit'),
    popular: t('popular'),
    list: t('duration'),
    usual: t('usual'),
    minutes: (count) => t('minutes', { count }),
    hours: words.note,
  };
}

/**
 * The hint under the duration: its length and when the first lesson ends,
 * "1 год · до 18:00"; the length alone while the start is unknown. The end
 * is wall-clock arithmetic on the typed start, like the start itself.
 */
export function useDurationHint() {
  const t = useTranslations('lessons.fields');
  const words = useDurationWords();
  return (minutes: number, start: string | null) => {
    if (!Number.isInteger(minutes) || minutes <= 0) return undefined;
    const match = start?.match(/^(\d{2}):(\d{2})$/);
    if (!match) return words.length(minutes);
    const total = (Number(match[1]) * 60 + Number(match[2]) + minutes) % (24 * 60);
    const end = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return t('durationHint', { length: words.length(minutes), end });
  };
}

/** The start time field's copy; the phone sheet names the day it is for. */
export function useTimeLabels(): TimeFieldLabels {
  const t = useTranslations('lessons.fields');
  return {
    placeholder: t('timePlaceholder'),
    custom: t('timeCustom'),
    typeHint: t('timeTypeHint'),
    list: t('time'),
    sheetTypeNote: t('timeSheetNote'),
    busyLegend: t('timeBusyLegend'),
    done: t('done'),
    close: t('close'),
  };
}

/** A calendar day in the forms' shapes: "чт, 01.10.2026" in the field, "чт, 1 жовтня" in titles. */
export function useFormDates() {
  const format = useFormatter();
  const locale = useLocale();
  const fromValue = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  };
  return {
    locale: locale === 'uk' ? uk : enUS,
    field: (date: Date) =>
      format.dateTime(date, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    /** "чт, 1 жовтня" for a "yyyy-MM-dd". */
    long: (value: string) => {
      const date = fromValue(value);
      return date ? format.dateTime(date, { weekday: 'short', day: 'numeric', month: 'long' }) : '';
    },
    /** "1 жовтня". */
    dayMonth: (value: string) => {
      const date = fromValue(value);
      return date ? format.dateTime(date, { day: 'numeric', month: 'long' }) : '';
    },
    fromValue,
  };
}

/** The date rows' copy; `dates` names each row for its remove button and its time sheet. */
export function useDateRowsLabels(dates: string[]): DateRowsLabels {
  const t = useTranslations('lessons.fields');
  const time = useTimeLabels();
  const formDates = useFormDates();
  const name = (index: number) => formDates.long(dates[index] ?? '') || String(index + 1);
  return {
    date: t('date'),
    time: t('time'),
    add: t('addDate'),
    pickDate: t('pickDate'),
    remove: (index) => t('removeDate', { date: name(index) }),
    timeField: time,
    timeSheetTitle: (index) =>
      dates[index] ? t('timeSheetTitle', { date: formDates.long(dates[index]!) }) : t('time'),
  };
}

/** Monday first, Sunday last. */
export function mondayFirst(weekday: number) {
  return (weekday + 6) % 7;
}

/**
 * Weekday slots in words: "Пн і Пт о 17:00" when they share a time, else each
 * day with its time ("Пн 17:00 · Ср 18:00"); `short` drops the "о" ("Пн і Пт ·
 * 17:00") for a chip. Null for no slots.
 */
export function useSlotsLabel() {
  const t = useTranslations('lessons.facts');
  const format = useFormatter();
  const days = useWeekdayLabels();
  return (
    slots: readonly { weekday: number; localTime: string }[] | undefined,
    { short = false }: { short?: boolean } = {},
  ): string | null => {
    if (!slots || slots.length === 0) return null;
    const sorted = [...slots].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday));
    const times = new Set(sorted.map((slot) => slot.localTime));
    if (times.size === 1) {
      const names = format.list(
        sorted.map((slot) => capitalizeFirst(days[slot.weekday] ?? '')),
        { type: 'conjunction' },
      );
      return short
        ? `${names} · ${sorted[0]!.localTime}`
        : t('slot', { days: names, time: sorted[0]!.localTime });
    }
    return sorted
      .map((slot) => `${capitalizeFirst(days[slot.weekday] ?? '')} ${slot.localTime}`)
      .join(' · ');
  };
}
