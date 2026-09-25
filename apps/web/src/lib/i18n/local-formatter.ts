'use client';

import { useMemo } from 'react';
import { useFormatter, type DateTimeFormatOptions } from 'next-intl';
import { useStudioTimeZone } from './time-zone';

type DateTimeOptions = DateTimeFormatOptions;

/**
 * The formatter of the lesson screens (the calendar, the Lessons list): the
 * studio's zone, the clock the calendar grid places lessons by (so a card's
 * time always matches its row), and a 24-hour clock in both locales so a
 * time fits a narrow card («10:00–11:00»).
 */
export function useLocalFormatter() {
  const format = useFormatter();
  const timeZone = useStudioTimeZone();
  return useMemo(() => {
    const withZone = (options: DateTimeOptions = {}): DateTimeOptions => ({
      timeZone,
      ...(options.hour ? { hourCycle: 'h23' as const } : {}),
      ...options,
    });
    return {
      dateTime: (value: Date, options?: DateTimeOptions) =>
        format.dateTime(value, withZone(options)),
      dateTimeRange: (start: Date, end: Date, options?: DateTimeOptions) =>
        format.dateTimeRange(start, end, withZone(options)),
      number: format.number,
      list: format.list,
      /** «18:40». */
      time: (value: Date | number) =>
        format.dateTime(new Date(value), withZone({ hour: '2-digit', minute: '2-digit' })),
    };
  }, [format, timeZone]);
}
