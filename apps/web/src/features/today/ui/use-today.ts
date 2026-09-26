'use client';

import { useMemo } from 'react';
import type { LessonPageResponse } from '@tutorio/validation';
import { useIsSoloWorkspace } from '@/components/app/session-provider';
import { useStoredChoice } from '@/hooks/use-stored-choice';
import { zonedDate } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import {
  useDashboardAttentionQuery,
  useDashboardMoneyQuery,
  useDashboardSetupQuery,
  useLessonWindowQuery,
  useTeachersQuery,
} from '../api';
import {
  dayOverview,
  lessonsOn,
  nearestDay,
  SCOPE_CHOICES,
  scopeMode,
  scopeView,
  daysFrom,
} from '../model/today';
import { setupDone } from './setup-block';

/** The package each direction pays with now, from the lesson windows' reads. */
function packagesOf(...pages: (LessonPageResponse | undefined)[]) {
  const map = new Map<string, { left: number; total: number }>();
  for (const page of pages) {
    for (const row of page?.packages ?? []) {
      map.set(row.enrollmentId, { left: row.left, total: row.total });
    }
  }
  return map;
}

/**
 * Everything the Today page reads, block by block: whose day it is, the
 * day and the two weeks after it, the money, the exceptions and the
 * first-run steps. Each block keeps its own loading and error.
 */
export function useToday(now: number) {
  const solo = useIsSoloWorkspace();
  const timeZone = useStudioTimeZone();
  // The windows move only when the studio's date does, not every minute.
  const today = zonedDate(new Date(now), timeZone);
  const days = useMemo(() => daysFrom(today, timeZone), [today, timeZone]);

  const teachers = useTeachersQuery({ page: 1, pageSize: 1, status: 'ACTIVE' }, !solo);
  const me = teachers.data?.me ?? null;
  const others = teachers.data
    ? teachers.data.counts.active - (me?.status === 'ACTIVE' ? 1 : 0)
    : 0;
  const mode = solo ? 'solo' : teachers.data ? scopeMode({ solo, me, others }) : null;
  const [choice, setChoice] = useStoredChoice('tutorio.today.scope', SCOPE_CHOICES, 'mine');
  const scope = scopeView(mode ?? 'solo', choice, me?.id ?? null);
  const scopeReady = mode !== null || teachers.isError;

  const setup = useDashboardSetupQuery();
  const day = useLessonWindowQuery({ ...days.day, teacherId: scope.teacherId }, scopeReady);
  const ahead = useLessonWindowQuery({ ...days.ahead, teacherId: scope.teacherId }, scopeReady);
  const money = useDashboardMoneyQuery();
  const attention = useDashboardAttentionQuery(scope.teacherId, scopeReady);

  const overview = useMemo(() => dayOverview(day.data?.items ?? [], now), [day.data, now]);
  const upcoming = useMemo(() => ahead.data?.items ?? [], [ahead.data]);
  const nearest = useMemo(() => nearestDay(upcoming, timeZone), [upcoming, timeZone]);
  const tomorrow = useMemo(
    () => lessonsOn(upcoming, days.tomorrow, timeZone),
    [upcoming, days.tomorrow, timeZone],
  );
  const packages = useMemo(() => packagesOf(day.data, ahead.data), [day.data, ahead.data]);

  return {
    days,
    mode,
    choice,
    setChoice,
    scope,
    meId: me?.id ?? null,
    setup,
    firstRun: setup.data ? !setupDone(setup.data) : false,
    day,
    dayLoading: !scopeReady || day.isPending,
    ahead,
    aheadLoading: !scopeReady || ahead.isPending,
    overview,
    nearest,
    tomorrow,
    packages,
    money,
    attention,
    attentionLoading: !scopeReady || attention.isPending,
  };
}
