'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ArchiveTeacherDto,
  CreateTeacherDto,
  TeacherArchivePreview,
  TeacherListResponse,
  TeacherResponse,
  TeacherStudentsResponse,
  TeacherSummary,
  UpdateTeacherDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { applyInvalidations, teacherInvalidations } from './invalidation';
import { queryKeys, type TeacherListFilters } from './keys';

/** The teacher page read, shared by the hook and by a screen that prefetches it. */
export function teachersQueryOptions(filters: TeacherListFilters) {
  return queryOptions<TeacherListResponse, GatewayError>({
    queryKey: queryKeys.teachers.lists(filters),
    queryFn: () =>
      gatewayFetch<TeacherListResponse>(
        `/api/backend/teachers${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          status: filters.status,
          subject: filters.subject,
          sort: filters.sort,
        })}`,
      ),
  });
}

export function useTeachersQuery(filters: TeacherListFilters, enabled = true) {
  return useQuery({
    ...teachersQueryOptions(filters),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useTeacherQuery(teacherId: string, enabled = true) {
  return useQuery<TeacherResponse, GatewayError>({
    queryKey: queryKeys.teachers.detail(teacherId),
    enabled: enabled && Boolean(teacherId),
    queryFn: () => gatewayFetch<TeacherResponse>(`/api/backend/teachers/${teacherId}`),
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

/** The profile's metrics: the load, the students and this month's lessons. */
export function useTeacherSummaryQuery(teacherId: string, enabled = true) {
  return useQuery<TeacherSummary, GatewayError>({
    queryKey: queryKeys.teachers.summary(teacherId),
    enabled: enabled && Boolean(teacherId),
    queryFn: () => gatewayFetch<TeacherSummary>(`/api/backend/teachers/${teacherId}/summary`),
  });
}

/**
 * The teacher's students by name. «Показати ще» asks for a longer first page,
 * so the rows already shown stay put while the rest loads.
 */
export function useTeacherStudentsQuery(teacherId: string, pageSize: number, enabled = true) {
  return useQuery<TeacherStudentsResponse, GatewayError>({
    queryKey: queryKeys.teachers.students(teacherId, pageSize),
    enabled: enabled && Boolean(teacherId),
    placeholderData: (previous) => previous,
    queryFn: () =>
      gatewayFetch<TeacherStudentsResponse>(
        `/api/backend/teachers/${teacherId}/students${buildQueryString({ page: 1, pageSize })}`,
      ),
  });
}

/** What archiving (or turning one's teaching off) hands over, and the new teacher's clashes. */
export function useTeacherArchivePreviewQuery(
  teacherId: string,
  transferTo: string | null,
  enabled = true,
) {
  return useQuery<TeacherArchivePreview, GatewayError>({
    queryKey: queryKeys.teachers.archivePreview(teacherId, transferTo),
    enabled: enabled && Boolean(teacherId),
    placeholderData: (previous) => previous,
    queryFn: () =>
      gatewayFetch<TeacherArchivePreview>(`/api/backend/teachers/${teacherId}/archive/preview`, {
        method: 'POST',
        body: JSON.stringify({ transferTo } satisfies ArchiveTeacherDto),
      }),
  });
}

export function useArchiveTeacherMutation(teacherId: string) {
  const queryClient = useQueryClient();
  return useMutation<TeacherResponse, GatewayError, { transferTo: string | null; force?: boolean }>(
    {
      mutationFn: ({ transferTo, force }) =>
        gatewayFetch<TeacherResponse>(
          `/api/backend/teachers/${teacherId}/archive${force ? '?force=true' : ''}`,
          { method: 'POST', body: JSON.stringify({ transferTo } satisfies ArchiveTeacherDto) },
        ),
      onSuccess: () => applyInvalidations(queryClient, teacherInvalidations({ kind: 'archive' })),
    },
  );
}

/** Makes an archived teacher — or the owner who stopped teaching — active again. */
export function useRestoreTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation<TeacherResponse, GatewayError, string>({
    mutationFn: (teacherId) =>
      gatewayFetch<TeacherResponse>(`/api/backend/teachers/${teacherId}/restore`, {
        method: 'POST',
      }),
    onSuccess: () => applyInvalidations(queryClient, teacherInvalidations({ kind: 'restore' })),
  });
}
