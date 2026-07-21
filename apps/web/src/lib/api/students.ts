'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateStudentDto,
  StudentDetail,
  StudentListResponse,
  StudentResponse,
  UpdateStudentDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type StudentListFilters } from './keys';

// Invalidating the audit list is a no-op for teachers (they never mount it),
// so hooks do not need to know the current role.
function invalidateStudentGraph(queryClient: QueryClient, studentId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
  if (studentId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(studentId) });
  }
}

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
        })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useStudentQuery(studentId: string) {
  return useQuery<StudentDetail, GatewayError>({
    queryKey: queryKeys.students.detail(studentId),
    queryFn: () => gatewayFetch<StudentDetail>(`/api/backend/students/${studentId}`),
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
    onSuccess: (student) => {
      invalidateStudentGraph(queryClient, student.id);
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
    onSuccess: () => {
      invalidateStudentGraph(queryClient, studentId);
    },
  });
}

// Destructive and restore mutations are never optimistic: the server is the
// only authority on whether they are allowed.
export function useDeleteStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (studentId) =>
      gatewayFetch<void>(`/api/backend/students/${studentId}`, { method: 'DELETE' }),
    onSuccess: (_result, studentId) => {
      invalidateStudentGraph(queryClient, studentId);
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
    onSuccess: (student) => {
      invalidateStudentGraph(queryClient, student.id);
    },
  });
}
