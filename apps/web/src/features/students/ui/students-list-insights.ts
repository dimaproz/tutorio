'use client';

import { useMemo } from 'react';
import { endOfWeek, startOfWeek } from 'date-fns';
import { useFormatter } from 'next-intl';
import { deriveCollectionMetrics } from '@/features/students/model/collection-metrics';
import { deriveStudentRollups } from '@/features/students/model/rollups';
import { useAllPackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery } from '@/lib/api/scheduling';
import type { PackagesReadState } from './student-row-cells';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead the collection looks for each student's next lesson. */
const UPCOMING_DAYS = 60;

/**
 * What the collection knows beyond the student rows: this week's lessons,
 * each student's next lesson, and the package-derived rollups and metrics.
 * Every window reads the page's one pinned clock.
 */
export function useStudentsCollectionInsights(now: number) {
  const format = useFormatter();

  // The lesson window is a flat, complete list, so the weekly count is exact.
  const week = useMemo(
    () => ({
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 }),
    }),
    [now],
  );
  const weekLessons = useLessonsQuery({
    from: week.from.toISOString(),
    to: week.to.toISOString(),
  });
  const upcomingLessons = useLessonsQuery({
    from: new Date(now).toISOString(),
    to: new Date(now + UPCOMING_DAYS * DAY_MS).toISOString(),
    status: 'SCHEDULED',
  });

  // Package metrics are derived client-side, so the read has to cover every
  // package for the aggregate to be true; the model rejects a partial set.
  const packages = useAllPackagesQuery({ state: 'active' });
  const packagesComplete = Boolean(
    packages.data && packages.data.items.length >= packages.data.total,
  );
  const packagesState: PackagesReadState = packages.isPending
    ? 'loading'
    : packages.isError || !packagesComplete
      ? 'unavailable'
      : 'ready';
  const packageMetrics = packages.isPending
    ? undefined
    : packages.isError || !packages.data
      ? null
      : deriveCollectionMetrics(packages.data.items, packages.data.total);
  const rollups = useMemo(
    () =>
      deriveStudentRollups({
        packages: packages.data?.items ?? [],
        packagesComplete,
        lessons: upcomingLessons.data?.items ?? [],
        now,
      }),
    [packages.data, packagesComplete, upcomingLessons.data, now],
  );

  // Lessons this week are the ones that take place: planned or taught. A
  // cancellation, charged or not, is not a lesson on the calendar.
  const weekItems = weekLessons.data?.items.filter(
    (lesson) => lesson.status === 'SCHEDULED' || lesson.status === 'COMPLETED',
  );
  const lessonsThisWeek = weekLessons.isPending
    ? undefined
    : !weekItems
      ? null
      : {
          total: weekItems.length,
          individual: weekItems.filter((lesson) => lesson.groupId === null).length,
          group: weekItems.filter((lesson) => lesson.groupId !== null).length,
          range: format.dateTimeRange(week.from, week.to, { day: 'numeric', month: 'short' }),
        };
  const studentsThisWeek = weekItems
    ? new Set(weekItems.flatMap((lesson) => (lesson.student ? [lesson.student.id] : []))).size
    : undefined;

  return { rollups, packagesState, packageMetrics, lessonsThisWeek, studentsThisWeek };
}
