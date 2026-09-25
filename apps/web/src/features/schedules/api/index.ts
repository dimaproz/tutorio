'use client';

import { useQuery } from '@tanstack/react-query';
import type { LessonPageResponse, ScheduleListResponse } from '@tutorio/validation';
import { buildQueryString, type FilterValue } from '@/lib/api/filters';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useGroupOptionsQuery } from '@/lib/api/groups';
export { useStudentQuery } from '@/lib/api/students';
export { useTeachersQuery } from '@/lib/api/teachers';

/**
 * The Schedules list read (S05): a page of schedules and every state's
 * count. It lives under `schedules`, so a create, change, stop or horizon
 * refreshes it; the previous page stays on screen while the next loads.
 */
export function useSchedulePageQuery(query: Record<string, FilterValue>) {
  return useQuery<ScheduleListResponse, GatewayError>({
    queryKey: [...queryKeys.schedules.all, 'page', query],
    placeholderData: (previous) => previous,
    queryFn: () =>
      gatewayFetch<ScheduleListResponse>(`/api/backend/schedules${buildQueryString(query)}`),
  });
}

/** How many lessons the week holds (one row read), for «38 занять цього тижня». */
export function useWeekLessonCountQuery(from: string, to: string) {
  return useQuery<LessonPageResponse, GatewayError, number>({
    queryKey: [...queryKeys.lessons.all, 'count', from, to],
    select: (page) => page.total,
    queryFn: () =>
      gatewayFetch<LessonPageResponse>(
        `/api/backend/lessons/list${buildQueryString({ from, to, page: 1, pageSize: 1 })}`,
      ),
  });
}
