'use client';

import { useQuery } from '@tanstack/react-query';
import type { LessonPageResponse } from '@tutorio/validation';
import { buildQueryString, type FilterValue } from '@/lib/api/filters';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useGroupOptionsQuery, useGroupQuery } from '@/lib/api/groups';
export { useStudentQuery, useStudentsQuery } from '@/lib/api/students';
export { useTeachersQuery } from '@/lib/api/teachers';

/**
 * The Lessons list read (S04): a page of lessons and the quick filters'
 * counts. It lives under `lessons`, so every lesson change refreshes it; the
 * previous page stays on screen while the next one loads.
 */
export function useLessonPageQuery(query: Record<string, FilterValue>, enabled = true) {
  return useQuery<LessonPageResponse, GatewayError>({
    queryKey: [...queryKeys.lessons.all, 'page', query],
    enabled,
    placeholderData: (previous) => previous,
    queryFn: () =>
      gatewayFetch<LessonPageResponse>(`/api/backend/lessons/list${buildQueryString(query)}`),
  });
}

/**
 * How many lessons a window holds (one row read), with no other filter: the
 * period's «248», the week's «12», and whether the studio has any lesson.
 */
export function useLessonCountQuery(from?: string, to?: string, enabled = true) {
  return useQuery<LessonPageResponse, GatewayError, number>({
    queryKey: [...queryKeys.lessons.all, 'count', from ?? null, to ?? null],
    enabled,
    select: (page) => page.total,
    queryFn: () =>
      gatewayFetch<LessonPageResponse>(
        `/api/backend/lessons/list${buildQueryString({ from, to, page: 1, pageSize: 1 })}`,
      ),
  });
}
