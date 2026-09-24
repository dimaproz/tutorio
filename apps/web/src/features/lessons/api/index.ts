'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateMakeupDto,
  EnrollmentBillingResponse,
  LessonAttendanceResponse,
  LessonDetailResponse,
  LessonResponse,
  RescheduleLessonDto,
  ScheduleChangeDto,
  ScheduleChangePreview,
  ScheduleResponse,
  SetLessonAttendanceDto,
  TransitionLessonDto,
  UpdateLessonDto,
} from '@tutorio/validation';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useLessonsQuery } from '@/lib/api/scheduling';
export { useLessonAttendanceQuery } from '@/lib/api/attendance';
export { usePackageQuery, usePackagesQuery } from '@/lib/api/packages';
export { useTeachersQuery } from '@/lib/api/teachers';
export { useGroupQuery } from '@/lib/api/groups';

/**
 * A lesson change moves its charges, so everything that shows a lesson or a
 * balance refreshes: lessons (lists, the panel, attendance), schedules, the
 * packages and directions it drew on, the groups and students that list it.
 */
function invalidateLessonGraph(queryClient: QueryClient) {
  for (const queryKey of [
    queryKeys.lessons.all,
    queryKeys.series.all,
    queryKeys.schedules.all,
    queryKeys.packages.all,
    queryKeys.enrollments.all,
    queryKeys.students.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
  void queryClient.invalidateQueries({
    queryKey: queryKeys.groups.all,
    predicate: (query) => query.queryKey[1] !== 'options',
  });
  // The audit log lives on the settings page: mark it stale, read it when shown.
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all, refetchType: 'none' });
}

const force = (value?: boolean) => (value ? '?force=true' : '');

/** One lesson for the side panel: the lesson, its original or makeup, schedule and history. */
export function useLessonDetailQuery(lessonId: string | null) {
  return useQuery<LessonDetailResponse, GatewayError>({
    queryKey: queryKeys.lessons.detail(lessonId ?? ''),
    enabled: Boolean(lessonId),
    // A deleted lesson answers 404 at once; retrying it only delays "not found".
    retry: (count, error) => error.status !== 404 && count < 2,
    queryFn: ({ signal }) =>
      gatewayFetch<LessonDetailResponse>(`/api/backend/lessons/${lessonId}`, { signal }),
  });
}

/** How a direction is paid now: its mode, rate and packages (L-10, L-81). */
export function useEnrollmentBillingQuery(enrollmentId: string | null) {
  return useQuery<EnrollmentBillingResponse, GatewayError>({
    queryKey: queryKeys.enrollments.billing(enrollmentId ?? ''),
    enabled: Boolean(enrollmentId),
    queryFn: ({ signal }) =>
      gatewayFetch<EnrollmentBillingResponse>(`/api/backend/enrollments/${enrollmentId}/billing`, {
        signal,
      }),
  });
}

export function useScheduleQuery(scheduleId: string | null) {
  return useQuery<ScheduleResponse, GatewayError>({
    queryKey: queryKeys.schedules.detail(scheduleId ?? ''),
    enabled: Boolean(scheduleId),
    queryFn: ({ signal }) =>
      gatewayFetch<ScheduleResponse>(`/api/backend/schedules/${scheduleId}`, { signal }),
  });
}

/** What changing a schedule would do, computed as the apply would (L-25). A read, not a save. */
export function useScheduleChangePreviewQuery(
  scheduleId: string | null,
  change: ScheduleChangeDto | null,
) {
  return useQuery<ScheduleChangePreview, GatewayError>({
    queryKey: queryKeys.schedules.preview(scheduleId ?? '', change),
    enabled: Boolean(scheduleId && change),
    queryFn: ({ signal }) =>
      gatewayFetch<ScheduleChangePreview>(`/api/backend/schedules/${scheduleId}/changes/preview`, {
        method: 'POST',
        body: JSON.stringify(change),
        signal,
      }),
  });
}

export function useTransitionLessonMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonResponse, GatewayError, TransitionLessonDto>({
    mutationFn: (dto) =>
      gatewayFetch<LessonResponse>(`/api/backend/lessons/${lessonId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

export function useUpdateLessonMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonResponse, GatewayError, { dto: UpdateLessonDto; force?: boolean }>({
    mutationFn: ({ dto, force: forced }) =>
      gatewayFetch<LessonResponse>(`/api/backend/lessons/${lessonId}${force(forced)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

export function useRescheduleLessonMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonResponse, GatewayError, { dto: RescheduleLessonDto; force?: boolean }>({
    mutationFn: ({ dto, force: forced }) =>
      gatewayFetch<LessonResponse>(`/api/backend/lessons/${lessonId}/reschedule${force(forced)}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

export function useCreateMakeupMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonResponse, GatewayError, { dto: CreateMakeupDto; force?: boolean }>({
    mutationFn: ({ dto, force: forced }) =>
      gatewayFetch<LessonResponse>(`/api/backend/lessons/${lessonId}/makeup${force(forced)}`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

export function useDeleteLessonMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, void>({
    mutationFn: () => gatewayFetch<void>(`/api/backend/lessons/${lessonId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.lessons.detail(lessonId) });
      invalidateLessonGraph(queryClient);
    },
  });
}

/** Sets marks for one lesson (L-74); the marks decide each member's charge (L-71). */
export function useSetAttendanceMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonAttendanceResponse, GatewayError, SetLessonAttendanceDto>({
    mutationFn: (dto) =>
      gatewayFetch<LessonAttendanceResponse>(`/api/backend/lessons/${lessonId}/attendance`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      }),
    onSuccess: (sheet) => {
      queryClient.setQueryData(queryKeys.lessons.attendance(lessonId), sheet);
      invalidateLessonGraph(queryClient);
    },
  });
}
