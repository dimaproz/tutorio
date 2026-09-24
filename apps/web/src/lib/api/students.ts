'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStudentDto,
  StudentDetail,
  StudentListResponse,
  StudentResponse,
  StudentsSummary,
  UpdateStudentDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { applyInvalidations, studentInvalidations } from './invalidation';
import { queryKeys, type StudentListFilters } from './keys';

export function useStudentsQuery(filters: StudentListFilters, enabled = true) {
  return useQuery<StudentListResponse, GatewayError>({
    queryKey: queryKeys.students.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<StudentListResponse>(
        `/api/backend/students${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          status: filters.status,
          groupId: filters.groupId,
          sort: filters.sort,
          order: filters.order,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

// Nested under ['students'], so every student mutation's invalidation of
// queryKeys.students.all refreshes the counts too.
const STUDENTS_SUMMARY_KEY = ['students', 'summary'] as const;

/** Per-status counts for the collection tabs and header, from one request. */
export function useStudentsSummaryQuery(enabled = true) {
  return useQuery<StudentsSummary, GatewayError>({
    queryKey: STUDENTS_SUMMARY_KEY,
    enabled,
    queryFn: () => gatewayFetch<StudentsSummary>('/api/backend/students/summary'),
  });
}

/** The student read, shared by the hook and by a screen that prefetches it. */
export function studentQueryOptions(studentId: string) {
  return queryOptions<StudentDetail, GatewayError>({
    queryKey: queryKeys.students.detail(studentId),
    queryFn: () => gatewayFetch<StudentDetail>(`/api/backend/students/${studentId}`),
  });
}

export function useStudentQuery(studentId: string, enabled = true) {
  return useQuery({ ...studentQueryOptions(studentId), enabled: enabled && Boolean(studentId) });
}

export function useCreateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation<StudentResponse, GatewayError, CreateStudentDto>({
    mutationFn: (dto) =>
      gatewayFetch<StudentResponse>('/api/backend/students', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_student, dto) => {
      applyInvalidations(queryClient, studentInvalidations({ kind: 'create', dto }));
    },
  });
}

export function useUpdateStudentMutation(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation<StudentResponse, GatewayError, UpdateStudentDto>({
    mutationFn: (dto) =>
      gatewayFetch<StudentResponse>(`/api/backend/students/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_student, dto) => {
      applyInvalidations(queryClient, studentInvalidations({ kind: 'update', dto }));
    },
  });
}

// Destructive and restore mutations are never optimistic: the server is the
// only authority on whether they are allowed.
export function useArchiveStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (studentId) =>
      gatewayFetch<void>(`/api/backend/students/${studentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      applyInvalidations(queryClient, studentInvalidations({ kind: 'archive' }));
    },
  });
}

export function useRestoreStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation<StudentResponse, GatewayError, string>({
    mutationFn: (studentId) =>
      gatewayFetch<StudentResponse>(`/api/backend/students/${studentId}/restore`, {
        method: 'POST',
      }),
    onSuccess: () => {
      applyInvalidations(queryClient, studentInvalidations({ kind: 'restore' }));
    },
  });
}
