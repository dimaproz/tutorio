'use client';

import { useTranslations } from 'next-intl';
import type { LessonListState } from '../model/filters';
import { usePeriodLabel } from './period-menu';

/**
 * What an empty result was asked for (S04 board 10): «Iryna Bondar · Sofiia
 * Melnyk · без оплати · Вересень 2026».
 */
export function useNoResultsSummary({
  state,
  now,
  teacherName,
  whoName,
}: {
  state: LessonListState;
  now: number;
  teacherName: string | null;
  whoName: string | null;
}): string {
  const t = useTranslations('lessonList');
  const period = usePeriodLabel();
  return [
    teacherName,
    whoName,
    state.quick === 'all' ? null : t(`summary.${state.quick}`),
    ...state.statuses.map((status) => t(`statuses.${status}`).toLocaleLowerCase()),
    state.search ? `«${state.search}»` : null,
    period(state, now),
  ]
    .filter(Boolean)
    .join(' · ');
}
