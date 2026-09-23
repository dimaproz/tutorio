'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTeacherDto,
  TeacherListResponse,
  TeacherResponse,
  UpdateTeacherDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { applyInvalidations, teacherInvalidations } from './invalidation';
import { queryKeys, type TeacherListFilters } from './keys';

export function useTeachersQuery(filters: TeacherListFilters, enabled = true) {
  return useQuery<TeacherListResponse, GatewayError>({
    queryKey: queryKeys.teachers.lists(filters),
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<TeacherListResponse>(
        `/api/backend/teachers${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          status: filters.status,
        })}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

export function useTeacherQuery(teacherId: string, enabled = true) {
  return useQuery<TeacherResponse, GatewayError>({
    queryKey: queryKeys.teachers.detail(teacherId),
    enabled: enabled && Boolean(teacherId),
    queryFn: ({ signal }) =>
      gatewayFetch<TeacherResponse>(`/api/backend/teachers/${teacherId}`, { signal }),
  });
}

export function useCreateTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation<TeacherResponse, GatewayError, CreateTeacherDto>({
    mutationFn: (dto) =>
      gatewayFetch<TeacherResponse>('/api/backend/teachers', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => applyInvalidations(queryClient, teacherInvalidations({ kind: 'create' })),
  });
}

export function useUpdateTeacherMutation(teacherId: string) {
  const queryClient = useQueryClient();
  return useMutation<TeacherResponse, GatewayError, UpdateTeacherDto>({
    mutationFn: (dto) =>
      gatewayFetch<TeacherResponse>(`/api/backend/teachers/${teacherId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_teacher, dto) =>
      applyInvalidations(queryClient, teacherInvalidations({ kind: 'update', dto })),
  });
}

export function useDeleteTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (teacherId) =>
      gatewayFetch<void>(`/api/backend/teachers/${teacherId}`, { method: 'DELETE' }),
    onSuccess: () => applyInvalidations(queryClient, teacherInvalidations({ kind: 'delete' })),
  });
}
