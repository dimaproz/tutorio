'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateParentDto,
  ParentDetail,
  ParentListResponse,
  ParentResponse,
  UpdateParentDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type ParentListFilters } from './keys';

// Parents affect the student roster (linked-student refs and vice versa), so
// mutations invalidate both graphs.
function invalidateParentGraph(queryClient: QueryClient, parentId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.parents.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
  if (parentId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parents.detail(parentId) });
  }
}

export function useParentsQuery(filters: ParentListFilters, enabled = true) {
  return useQuery<ParentListResponse, GatewayError>({
    queryKey: queryKeys.parents.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<ParentListResponse>(
        `/api/backend/parents${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useParentQuery(parentId: string, enabled = true) {
  return useQuery<ParentDetail, GatewayError>({
    queryKey: queryKeys.parents.detail(parentId),
    enabled: enabled && Boolean(parentId),
    queryFn: () => gatewayFetch<ParentDetail>(`/api/backend/parents/${parentId}`),
  });
}

export function useCreateParentMutation() {
  const queryClient = useQueryClient();
  return useMutation<ParentResponse, GatewayError, CreateParentDto>({
    mutationFn: (dto) =>
      gatewayFetch<ParentResponse>('/api/backend/parents', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: (parent) => {
      invalidateParentGraph(queryClient, parent.id);
    },
  });
}

export function useUpdateParentMutation(parentId: string) {
  const queryClient = useQueryClient();
  return useMutation<ParentResponse, GatewayError, UpdateParentDto>({
    mutationFn: (dto) =>
      gatewayFetch<ParentResponse>(`/api/backend/parents/${parentId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      invalidateParentGraph(queryClient, parentId);
    },
  });
}

export function useDeleteParentMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (parentId) =>
      gatewayFetch<void>(`/api/backend/parents/${parentId}`, { method: 'DELETE' }),
    onSuccess: (_result, parentId) => {
      invalidateParentGraph(queryClient, parentId);
    },
  });
}

export function useRestoreParentMutation() {
  const queryClient = useQueryClient();
  return useMutation<ParentResponse, GatewayError, string>({
    mutationFn: (parentId) =>
      gatewayFetch<ParentResponse>(`/api/backend/parents/${parentId}/restore`, {
        method: 'POST',
      }),
    onSuccess: (parent) => {
      invalidateParentGraph(queryClient, parent.id);
    },
  });
}
