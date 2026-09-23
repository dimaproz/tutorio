'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateGroupDto,
  GroupAttendanceResponse,
  GroupDetail,
  GroupListResponse,
  GroupOptionsResponse,
  GroupResponse,
  GroupSummaryResponse,
  UpdateGroupDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type GroupListFilters } from './keys';

/**
 * Invalidation follows what a group command actually touched. `groups.all`
 * is a prefix, so it covers every list, the summary, the options and every
 * detail at once. Domains a command only makes stale are marked without a
 * refetch; they reload when a screen next shows them.
 */
function invalidateAfterGroupChange(
  queryClient: QueryClient,
  touched: { roster?: boolean; schedule?: boolean } = {},
) {
  // The attendance sheet changes only with the roster; a rename or a notes
  // save must not read it again.
  void queryClient.invalidateQueries({
    queryKey: queryKeys.groups.all,
    predicate: (query) => touched.roster === true || query.queryKey[1] !== 'attendance',
  });
  if (touched.roster) {
    // Student rows name their groups; enrollments are the roster itself.
    void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.students.all,
      refetchType: 'none',
    });
  }
  if (touched.roster || touched.schedule) {
    // A roster or schedule change generates, moves or suspends lessons.
    void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.series.all });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all, refetchType: 'none' });
}

export function useGroupsQuery(filters: GroupListFilters, enabled = true) {
  return useQuery<GroupListResponse, GatewayError>({
    queryKey: queryKeys.groups.lists(filters),
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<GroupListResponse>(
        `/api/backend/groups${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          status: filters.status,
          studentId: filters.studentId,
          teacherId: filters.teacherId,
          weekday: filters.weekday,
          payment: filters.payment,
          sort: filters.sort,
          order: filters.order,
        })}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

/** The collection headline: tab counts and the four metrics in one read. */
export function useGroupsSummaryQuery(enabled = true) {
  return useQuery<GroupSummaryResponse, GatewayError>({
    queryKey: queryKeys.groups.summary,
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<GroupSummaryResponse>('/api/backend/groups/summary', { signal }),
  });
}

/** Every live group by name, for filters and pickers. */
export function useGroupOptionsQuery(enabled = true) {
  return useQuery<GroupOptionsResponse, GatewayError>({
    queryKey: queryKeys.groups.options,
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<GroupOptionsResponse>('/api/backend/groups/options', { signal }),
  });
}

export function useGroupQuery(groupId: string, enabled = true) {
  return useQuery<GroupDetail, GatewayError>({
    queryKey: queryKeys.groups.detail(groupId),
    enabled: enabled && Boolean(groupId),
    queryFn: ({ signal }) =>
      gatewayFetch<GroupDetail>(`/api/backend/groups/${groupId}`, { signal }),
  });
}

export function useGroupAttendanceQuery(groupId: string, window: number, enabled = true) {
  return useQuery<GroupAttendanceResponse, GatewayError>({
    queryKey: queryKeys.groups.attendance(groupId, window),
    enabled: enabled && Boolean(groupId),
    queryFn: ({ signal }) =>
      gatewayFetch<GroupAttendanceResponse>(
        `/api/backend/groups/${groupId}/attendance${buildQueryString({ window })}`,
        { signal },
      ),
  });
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<GroupResponse, GatewayError, CreateGroupDto>({
    mutationFn: (dto) =>
      gatewayFetch<GroupResponse>('/api/backend/groups', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_group, dto) =>
      invalidateAfterGroupChange(queryClient, {
        roster: Boolean(dto.students?.studentIds.length),
        schedule: Boolean(dto.schedule),
      }),
  });
}

export function useUpdateGroupMutation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<GroupResponse, GatewayError, UpdateGroupDto>({
    mutationFn: (dto) =>
      gatewayFetch<GroupResponse>(`/api/backend/groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_group, dto) =>
      invalidateAfterGroupChange(queryClient, {
        // A new teacher moves the roster's enrollments and upcoming lessons.
        roster: Boolean(dto.students) || Boolean(dto.teacherId),
        schedule: Boolean(dto.schedule) || Boolean(dto.teacherId),
      }),
  });
}

/** `DELETE /groups/:id` archives: the roster and money stay, future lessons stop. */
export function useArchiveGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (groupId) =>
      gatewayFetch<void>(`/api/backend/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfterGroupChange(queryClient, { roster: true, schedule: true }),
  });
}

export function useRestoreGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<GroupResponse, GatewayError, string>({
    mutationFn: (groupId) =>
      gatewayFetch<GroupResponse>(`/api/backend/groups/${groupId}/restore`, { method: 'POST' }),
    onSuccess: () => invalidateAfterGroupChange(queryClient, { roster: true, schedule: true }),
  });
}
