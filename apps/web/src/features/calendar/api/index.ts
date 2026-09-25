'use client';

import { useQuery } from '@tanstack/react-query';
import type { LessonPageResponse } from '@tutorio/validation';
import { buildQueryString } from '@/lib/api/filters';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useLessonsQuery } from '@/lib/api/scheduling';
export { useTeachersQuery } from '@/lib/api/teachers';

/**
 * The first scheduled lesson after a period, for the empty week («Найближче
 * заняття») and the free day («Наступне»): the Lessons list read, oldest
 * first, one row.
 */
export function useNextLessonQuery(from: string, teacherId: string | undefined, enabled: boolean) {
  return useQuery<LessonPageResponse, GatewayError>({
    queryKey: [...queryKeys.lessons.all, 'next', from, teacherId ?? null],
    enabled,
    queryFn: () =>
      gatewayFetch<LessonPageResponse>(
        `/api/backend/lessons/list${buildQueryString({
          from,
          teacherId,
          status: 'SCHEDULED',
          order: 'asc',
          page: 1,
          pageSize: 1,
        })}`,
      ),
  });
}
