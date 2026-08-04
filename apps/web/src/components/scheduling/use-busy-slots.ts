'use client';

import { useMemo } from 'react';
import { findConflicts, toInterval } from '@tutorio/domain';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { joinDateTimeInput, parseLocalInput } from '@/lib/datetime';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Marks the time slots a teacher is already booked for, so the picker can grey
 * them out instead of letting the tutor walk into the server's 409. Overlap is
 * measured the same way the API measures it — the shared domain helper — so the
 * two can never disagree about what "busy" means.
 *
 * Only the days the tutor has actually picked are fetched: the window is the
 * span of the chosen dates, and nothing is requested until there is one.
 */
export function useBusySlots({
  teacherId,
  dates,
  durationMin,
  ignoreLessonIds = [],
  enabled = true,
}: {
  teacherId: string;
  /** The "YYYY-MM-DD" days currently chosen in the form. */
  dates: string[];
  durationMin: number;
  /** Lessons to treat as free — the one being rescheduled, for instance. */
  ignoreLessonIds?: string[];
  enabled?: boolean;
}) {
  const days = useMemo(() => {
    const parsed = dates
      .map((date) => parseLocalInput(date))
      .filter((date): date is Date => date != null)
      .map((date) => date.getTime())
      .sort((a, b) => a - b);
    return parsed.length > 0 ? { first: parsed[0], last: parsed[parsed.length - 1] } : null;
  }, [dates]);

  const lessons = useLessonsQuery(
    {
      from: new Date(days?.first ?? 0).toISOString(),
      to: new Date((days?.last ?? 0) + DAY_MS).toISOString(),
      teacherId,
    },
    enabled && days !== null && Boolean(teacherId),
  );

  // Compared by value: the caller usually rebuilds this array every render.
  const ignoredKey = ignoreLessonIds.join(',');

  return useMemo(() => {
    // A cancelled lesson frees its slot; a completed one still occupied it.
    const booked = (lessons.data?.items ?? [])
      .filter(
        (lesson) =>
          !ignoreLessonIds.includes(lesson.id) &&
          lesson.status !== 'CANCELLED_CHARGED' &&
          lesson.status !== 'CANCELLED_UNCHARGED',
      )
      .map((lesson) => ({
        ...toInterval(new Date(lesson.startsAtUtc), lesson.durationMin),
        id: lesson.id,
      }));

    return {
      isFetching: lessons.isFetching,
      isSlotUnavailable: (date: string, time: string): boolean => {
        const start = parseLocalInput(joinDateTimeInput(date, time, ''));
        if (!start) {
          return false;
        }
        return findConflicts(toInterval(start, durationMin), booked).length > 0;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ignoredKey stands in for the array
  }, [lessons.data, lessons.isFetching, durationMin, ignoredKey]);
}
