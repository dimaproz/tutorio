'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateEnrollmentDto,
  EnrollmentListResponse,
  EnrollmentResponse,
  UpdateEnrollmentDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type EnrollmentListFilters } from './keys';

// An enrollment change is visible on the student card, the group page and the
// audit trail, so all three graphs are invalidated.
function invalidateEnrollmentGraph(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
}

export function useEnrollmentsQuery(filters: EnrollmentListFilters, enabled = true) {
  return useQuery<EnrollmentListResponse, GatewayError>({
    queryKey: queryKeys.enrollments.lists(filters),
    queryFn: () =>
      gatewayFetch<EnrollmentListResponse>(
        `/api/backend/enrollments${buildQueryString({
          page: filters.page,
          studentId: filters.studentId,
          groupId: filters.groupId,
          teacherId: filters.teacherId,
          status: filters.status,
        })}`,
      ),
    enabled,
  });
}

// Enrollment mutations carry money rules, so they always use the authoritative
// server response plus targeted invalidation — never optimistic updates.
export function useCreateEnrollmentMutation() {
  const queryClient = useQueryClient();
  return useMutation<EnrollmentResponse, GatewayError, CreateEnrollmentDto>({
    mutationFn: (dto) =>
      gatewayFetch<EnrollmentResponse>('/api/backend/enrollments', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      invalidateEnrollmentGraph(queryClient);
    },
  });
}

export function useUpdateEnrollmentMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    EnrollmentResponse,
    GatewayError,
    { enrollmentId: string; dto: UpdateEnrollmentDto }
  >({
    mutationFn: ({ enrollmentId, dto }) =>
      gatewayFetch<EnrollmentResponse>(`/api/backend/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      invalidateEnrollmentGraph(queryClient);
    },
  });
}

export function useDeleteEnrollmentMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (enrollmentId) =>
      gatewayFetch<void>(`/api/backend/enrollments/${enrollmentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateEnrollmentGraph(queryClient);
    },
  });
}
