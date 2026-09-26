'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DashboardAttentionResponse,
  DashboardMoneyResponse,
  DashboardSetupResponse,
  LessonPageResponse,
} from '@tutorio/validation';
import { buildQueryString } from '@/lib/api/filters';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useTeachersQuery } from '@/lib/api/teachers';

/** The dashboard's own reads; the day lives under the lessons so lesson changes refresh it. */
const dashboardKeys = {
  all: ['dashboard'] as const,
  money: ['dashboard', 'money'] as const,
  attention: (teacherId: string | null) => ['dashboard', 'attention', teacherId] as const,
  setup: ['dashboard', 'setup'] as const,
};

/** «Гроші за місяць»: the whole studio, per currency. */
export function useDashboardMoneyQuery(enabled = true) {
  return useQuery<DashboardMoneyResponse, GatewayError>({
    queryKey: dashboardKeys.money,
    enabled,
    queryFn: () => gatewayFetch<DashboardMoneyResponse>('/api/backend/dashboard/money'),
  });
}

/** «Потребує уваги», for one teacher («Мої») or the studio. */
export function useDashboardAttentionQuery(teacherId: string | null, enabled = true) {
  return useQuery<DashboardAttentionResponse, GatewayError>({
    queryKey: dashboardKeys.attention(teacherId),
    enabled,
    queryFn: () =>
      gatewayFetch<DashboardAttentionResponse>(
        `/api/backend/dashboard/attention${buildQueryString({ teacherId: teacherId ?? undefined })}`,
      ),
  });
}

/** The first-run checklist's steps. */
export function useDashboardSetupQuery() {
  return useQuery<DashboardSetupResponse, GatewayError>({
    queryKey: dashboardKeys.setup,
    queryFn: () => gatewayFetch<DashboardSetupResponse>('/api/backend/dashboard/setup'),
  });
}

/** Every lesson of a window, earliest first, with the package each direction pays with now. */
export function useLessonWindowQuery(
  window: { from: string; to: string; teacherId: string | null },
  enabled = true,
) {
  const query = {
    from: window.from,
    to: window.to,
    teacherId: window.teacherId ?? undefined,
    order: 'asc',
    page: 1,
    pageSize: 100,
  };
  return useQuery<LessonPageResponse, GatewayError>({
    queryKey: [...queryKeys.lessons.listsAll, 'window', query],
    enabled,
    queryFn: () =>
      gatewayFetch<LessonPageResponse>(`/api/backend/lessons/list${buildQueryString(query)}`),
  });
}

/**
 * An exception leaves only when its cause is resolved — paid, marked, sold,
 * extended, returned — through dialogs other features own. Their mutations
 * refresh their own data; the dashboard's reads follow any mutation that
 * succeeds, so a card updates in place after the action.
 */
export function useDashboardFollowsMutations() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success') {
          void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        }
      }),
    [queryClient],
  );
}
