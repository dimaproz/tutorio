'use client';

import { useMemo } from 'react';
import { useFormatter } from 'next-intl';
import { deriveCollectionMetrics } from '@/features/students/model/collection-metrics';
import {
  collectionLessonWindow,
  splitCollectionLessons,
} from '@/features/students/model/lesson-window';
import { deriveStudentRollups } from '@/features/students/model/rollups';
import { useAllPackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery } from '@/lib/api/scheduling';
import type { PackagesReadState } from './student-row-cells';

/**
 * What the collection knows beyond the student rows: this week's lessons,
 * each student's next lesson, and the package-derived rollups and metrics.
 * Every window reads the page's one pinned clock.
 */
export function useStudentsCollectionInsights(now: number) {
  const format = useFormatter();

  // One lesson read covers both the week and the upcoming horizon. It is a
  // flat, complete list, so the weekly count is exact.
  const lessonWindow = useMemo(() => collectionLessonWindow(now), [now]);
  const lessons = useLessonsQuery(lessonWindow.query);
  const split = useMemo(
    () =>
      lessons.data ? splitCollectionLessons(lessons.data.items, lessonWindow, now) : undefined,
    [lessons.data, lessonWindow, now],
  );

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
        lessons: split?.upcoming ?? [],
        now,
      }),
    [packages.data, packagesComplete, split, now],
  );

  // Lessons this week are the ones that take place: planned or taught. A
  // cancellation, charged or not, is not a lesson on the calendar.
  const weekItems = split?.week.filter(
    (lesson) => lesson.status === 'SCHEDULED' || lesson.status === 'COMPLETED',
  );
  const lessonsThisWeek = lessons.isPending
    ? undefined
    : !weekItems
      ? null
      : {
          total: weekItems.length,
          individual: weekItems.filter((lesson) => lesson.groupId === null).length,
          group: weekItems.filter((lesson) => lesson.groupId !== null).length,
          range: format.dateTimeRange(lessonWindow.week.from, lessonWindow.week.to, {
            day: 'numeric',
            month: 'short',
          }),
        };
  const studentsThisWeek = weekItems
    ? new Set(weekItems.flatMap((lesson) => (lesson.student ? [lesson.student.id] : []))).size
    : undefined;

  return { rollups, packagesState, packageMetrics, lessonsThisWeek, studentsThisWeek };
}
