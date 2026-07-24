'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  CreateTeacherDto,
  TeacherListResponse,
  TeacherResponse,
  UpdateTeacherDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type TeacherListFilters } from './keys';

function invalidateTeacherGraph(queryClient: QueryClient, teacherId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
  // Teacher names/colors surface on enrollments, groups and the calendar.
  void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
  if (teacherId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.teachers.detail(teacherId) });
  }
}

export function useTeachersQuery(filters: TeacherListFilters, enabled = true) {
  return useQuery<TeacherListResponse, GatewayError>({
    queryKey: queryKeys.teachers.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<TeacherListResponse>(
        `/api/backend/teachers${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          state: filters.state,
          status: filters.status,
        })}`,
      ),
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
    onSuccess: (teacher) => invalidateTeacherGraph(queryClient, teacher.id),
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
    onSuccess: () => invalidateTeacherGraph(queryClient, teacherId),
  });
}

export function useDeleteTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (teacherId) =>
      gatewayFetch<void>(`/api/backend/teachers/${teacherId}`, { method: 'DELETE' }),
    onSuccess: (_result, teacherId) => invalidateTeacherGraph(queryClient, teacherId),
  });
}
