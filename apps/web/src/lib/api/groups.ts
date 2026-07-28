'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateGroupDto,
  GroupDetail,
  GroupListResponse,
  GroupResponse,
  UpdateGroupDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type GroupListFilters } from './keys';

// `groups.all` is a key prefix, so it already covers every group list and
// detail — invalidating a detail key on top of it only buys a second refetch.
function invalidateGroupGraph(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
}

export function useGroupsQuery(filters: GroupListFilters, enabled = true) {
  return useQuery<GroupListResponse, GatewayError>({
    queryKey: queryKeys.groups.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<GroupListResponse>(
        `/api/backend/groups${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          status: filters.status,
          schedule: filters.schedule,
          studentId: filters.studentId,
          sort: filters.sort,
          order: filters.order,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useGroupQuery(groupId: string, enabled = true) {
  return useQuery<GroupDetail, GatewayError>({
    queryKey: queryKeys.groups.detail(groupId),
    enabled: enabled && Boolean(groupId),
    queryFn: () => gatewayFetch<GroupDetail>(`/api/backend/groups/${groupId}`),
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
    onSuccess: () => {
      invalidateGroupGraph(queryClient);
    },
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
    onSuccess: () => {
      invalidateGroupGraph(queryClient);
    },
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (groupId) =>
      gatewayFetch<void>(`/api/backend/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateGroupGraph(queryClient);
    },
  });
}

export function useRestoreGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<GroupResponse, GatewayError, string>({
    mutationFn: (groupId) =>
      gatewayFetch<GroupResponse>(`/api/backend/groups/${groupId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      invalidateGroupGraph(queryClient);
    },
  });
}
