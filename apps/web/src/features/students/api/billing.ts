'use client';

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  CreatePauseDto,
  EnrollmentResponse,
  PauseEndPreviewResponse,
  PauseListResponse,
  PausePreviewDto,
  PausePreviewResponse,
  PauseResponse,
  PaymentListResponse,
  PaymentResponse,
  RecordPaymentDto,
  ScheduleListResponse,
  StudentBillingResponse,
  UpdateEnrollmentDto,
  UpdatePauseDto,
} from '@tutorio/validation';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

/** The student profile's billing reads (S06): one prefix, so a change refreshes them all. */
export const studentBillingKeys = {
  billing: queryKeys.students.billing,
  pauses: (studentId: string) => ['pauses', 'student', studentId] as const,
  payments: (studentId: string) => ['payments', 'student', studentId] as const,
};

/** The API's largest page. */
const PAGE_MAX = 100;

/**
 * Money and pauses move lessons, credits and balances, so a change refreshes
 * the student (billing, profile), the lessons and schedules, the packages and
 * payments, the pauses and the audit trail.
 */
export function invalidateStudentBilling(queryClient: QueryClient) {
  for (const queryKey of [
    queryKeys.students.all,
    queryKeys.lessons.all,
    queryKeys.series.all,
    queryKeys.schedules.all,
    queryKeys.packages.all,
    queryKeys.payments.all,
    queryKeys.enrollments.all,
    ['pauses'],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all, refetchType: 'none' });
}

/** Every direction of the student with how it is paid (L-10, L-82, L-90). */
export function useStudentBillingQuery(studentId: string, enabled = true) {
  return useQuery<StudentBillingResponse, GatewayError>({
    queryKey: studentBillingKeys.billing(studentId),
    enabled,
    queryFn: () =>
      gatewayFetch<StudentBillingResponse>(`/api/backend/students/${studentId}/billing`),
  });
}

/** The student's scheduled and running pauses (L-100). */
export function useStudentPausesQuery(studentId: string, enabled = true) {
  return useQuery<PauseListResponse, GatewayError>({
    queryKey: studentBillingKeys.pauses(studentId),
    enabled,
    queryFn: () =>
      gatewayFetch<PauseListResponse>(
        `/api/backend/pauses?studentId=${studentId}&state=current&page=1&pageSize=${PAGE_MAX}`,
      ),
  });
}

/** The student's payments and refunds, newest first (the «Оплати» tab). */
export function useStudentPaymentsQuery(studentId: string, enabled = true) {
  return useQuery<PaymentListResponse, GatewayError>({
    queryKey: studentBillingKeys.payments(studentId),
    enabled,
    queryFn: () =>
      gatewayFetch<PaymentListResponse>(
        `/api/backend/payments?studentId=${studentId}&page=1&pageSize=${PAGE_MAX}`,
      ),
  });
}

/**
 * The active schedules of the student's directions: the individual ones in
 * one read, each group's own (a group schedule belongs to the group, L-20).
 */
export function useDirectionSchedules(studentId: string, groupIds: readonly string[]) {
  const reads = [`studentId=${studentId}`, ...groupIds.map((groupId) => `groupId=${groupId}`)];
  return useQueries({
    queries: reads.map((filter) => ({
      queryKey: [...queryKeys.schedules.all, 'direction', filter],
      queryFn: () =>
        gatewayFetch<ScheduleListResponse>(
          `/api/backend/schedules?${filter}&state=ACTIVE&page=1&pageSize=20`,
        ),
    })),
    combine: (results) => ({
      items: results.flatMap((result) => result.data?.items ?? []),
      pending: results.some((result) => result.isPending),
    }),
  });
}

export function useRecordStudentPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<PaymentResponse, GatewayError, RecordPaymentDto>({
    mutationFn: (dto) =>
      gatewayFetch<PaymentResponse>('/api/backend/payments', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateStudentBilling(queryClient),
  });
}

export function useUpdateDirectionMutation() {
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
    onSuccess: () => invalidateStudentBilling(queryClient),
  });
}

/** What a pause would do before it is saved (L-101, L-102). */
export function usePausePreviewQuery(dto: PausePreviewDto | null) {
  return useQuery<PausePreviewResponse, GatewayError>({
    queryKey: ['pauses', 'preview', dto],
    enabled: dto !== null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      gatewayFetch<PausePreviewResponse>('/api/backend/pauses/preview', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  });
}

/** What ending or cancelling a pause now would do, with its conflicts (L-103, L-110). */
export function usePauseEndPreviewQuery(pauseId: string | null) {
  return useQuery<PauseEndPreviewResponse, GatewayError>({
    queryKey: ['pauses', 'endPreview', pauseId],
    enabled: pauseId !== null,
    staleTime: 0,
    queryFn: () =>
      gatewayFetch<PauseEndPreviewResponse>(`/api/backend/pauses/${pauseId}/end/preview`, {
        method: 'POST',
      }),
  });
}

/** How a pause end treats the lessons whose time is taken since (L-111). */
export type PauseEndMode = 'check' | 'force' | 'skip';

const endQuery = (mode: PauseEndMode) =>
  mode === 'force' ? '?force=true' : mode === 'skip' ? '?skipConflicts=true' : '';

export function useCreatePauseMutation() {
  const queryClient = useQueryClient();
  return useMutation<PauseResponse, GatewayError, CreatePauseDto>({
    mutationFn: (dto) =>
      gatewayFetch<PauseResponse>('/api/backend/pauses', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateStudentBilling(queryClient),
  });
}

export function useUpdatePauseMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    PauseResponse,
    GatewayError,
    { pauseId: string; dto: UpdatePauseDto; mode: PauseEndMode }
  >({
    mutationFn: ({ pauseId, dto, mode }) =>
      gatewayFetch<PauseResponse>(`/api/backend/pauses/${pauseId}${endQuery(mode)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateStudentBilling(queryClient),
  });
}

/** Ends a running pause now, or cancels one that has not begun (L-103). */
export function useEndPauseMutation() {
  const queryClient = useQueryClient();
  return useMutation<PauseResponse, GatewayError, { pauseId: string; mode: PauseEndMode }>({
    mutationFn: ({ pauseId, mode }) =>
      gatewayFetch<PauseResponse>(`/api/backend/pauses/${pauseId}/end${endQuery(mode)}`, {
        method: 'POST',
      }),
    onSuccess: () => invalidateStudentBilling(queryClient),
  });
}
