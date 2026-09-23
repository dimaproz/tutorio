'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStudentDto,
  StudentDetail,
  StudentListResponse,
  StudentResponse,
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
    queryFn: ({ signal }) =>
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
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

export function useStudentQuery(studentId: string, enabled = true) {
  return useQuery<StudentDetail, GatewayError>({
    queryKey: queryKeys.students.detail(studentId),
    enabled: enabled && Boolean(studentId),
    queryFn: ({ signal }) =>
      gatewayFetch<StudentDetail>(`/api/backend/students/${studentId}`, { signal }),
  });
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
