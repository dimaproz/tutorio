'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateParentDto,
  ParentDetail,
  ParentListResponse,
  ParentResponse,
  UpdateParentDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { applyInvalidations, parentInvalidations } from './invalidation';
import { queryKeys, type ParentListFilters } from './keys';

export function useParentsQuery(filters: ParentListFilters, enabled = true) {
  return useQuery<ParentListResponse, GatewayError>({
    queryKey: queryKeys.parents.lists(filters),
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<ParentListResponse>(
        `/api/backend/parents${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          studentId: filters.studentId,
          linked: filters.linked,
          sort: filters.sort,
          order: filters.order,
        })}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

export function useParentQuery(parentId: string, enabled = true) {
  return useQuery<ParentDetail, GatewayError>({
    queryKey: queryKeys.parents.detail(parentId),
    enabled: enabled && Boolean(parentId),
    queryFn: ({ signal }) =>
      gatewayFetch<ParentDetail>(`/api/backend/parents/${parentId}`, { signal }),
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
    onSuccess: (_parent, dto) => {
      applyInvalidations(queryClient, parentInvalidations({ kind: 'create', dto }));
    },
  });
}

export function useUpdateParentMutation(parentId: string) {
  const queryClient = useQueryClient();
  return useMutation<ParentResponse, GatewayError, UpdateParentDto>({
    // Lets the profile hold its link command while any save of this parent runs.
    mutationKey: ['parents', 'update', parentId],
    mutationFn: (dto) =>
      gatewayFetch<ParentResponse>(`/api/backend/parents/${parentId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_parent, dto) => {
      applyInvalidations(queryClient, parentInvalidations({ kind: 'update', dto }));
    },
  });
}

export function useDeleteParentMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (parentId) =>
      gatewayFetch<void>(`/api/backend/parents/${parentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      applyInvalidations(queryClient, parentInvalidations({ kind: 'delete' }));
    },
  });
}
