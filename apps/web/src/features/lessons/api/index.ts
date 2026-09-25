'use client';

import { useEffect } from 'react';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  BulkCancelDto,
  BulkCancelPreview,
  BulkCancelResult,
  CreateLessonDto,
  CreateMakeupDto,
  CreateScheduleDto,
  EnrollmentBillingResponse,
  LessonAttendanceResponse,
  LessonDetailResponse,
  LessonListResponse,
  LessonResponse,
  PauseListResponse,
  RescheduleLessonDto,
  ScheduleChangeDto,
  ScheduleChangePreview,
  ScheduleChangeResult,
  ScheduleCreatePreview,
  ScheduleHorizonPreview,
  ScheduleListResponse,
  ScheduleResponse,
  StudentBillingResponse,
  SetLessonAttendanceDto,
  StopScheduleDto,
  TransitionLessonDto,
  UpdateLessonDto,
} from '@tutorio/validation';
import { lessonAttendanceQueryOptions } from '@/lib/api/attendance';
import { groupQueryOptions } from '@/lib/api/groups';
import { queryKeys, type PackageListFilters, type TeacherListFilters } from '@/lib/api/keys';
import { packagesQueryOptions } from '@/lib/api/packages';
import { studentQueryOptions } from '@/lib/api/students';
import { teachersQueryOptions } from '@/lib/api/teachers';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useLessonsQuery } from '@/lib/api/scheduling';
export { useLessonAttendanceQuery } from '@/lib/api/attendance';
export { usePackageQuery, usePackagesQuery } from '@/lib/api/packages';
export { useTeachersQuery } from '@/lib/api/teachers';
export { useGroupQuery, useGroupsQuery, useGroupsSummaryQuery } from '@/lib/api/groups';
export { useStudentQuery, useStudentsQuery, useStudentsSummaryQuery } from '@/lib/api/students';

/**
 * A lesson change moves its charges, so everything that shows a lesson or a
 * balance refreshes: lessons (lists, the panel, attendance), schedules, the
 * packages and directions it drew on, the groups and students that list it.
 */
export function invalidateLessonGraph(queryClient: QueryClient) {
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
    queryFn: () => gatewayFetch<LessonDetailResponse>(`/api/backend/lessons/${lessonId}`),
  });
}

function enrollmentBillingQueryOptions(enrollmentId: string) {
  return queryOptions<EnrollmentBillingResponse, GatewayError>({
    queryKey: queryKeys.enrollments.billing(enrollmentId),
    queryFn: () =>
      gatewayFetch<EnrollmentBillingResponse>(`/api/backend/enrollments/${enrollmentId}/billing`),
  });
}

/** How a direction is paid now: its mode, rate and packages (L-10, L-81). */
export function useEnrollmentBillingQuery(enrollmentId: string | null) {
  return useQuery({
    ...enrollmentBillingQueryOptions(enrollmentId ?? ''),
    enabled: Boolean(enrollmentId),
  });
}

/** The teachers the panel's pickers offer. */
export const TEACHER_OPTIONS_FILTERS: TeacherListFilters = { page: 1, pageSize: 100, state: 'all' };

/** The packages a group lesson's members pay with. */
export function groupPackagesFilters(groupId: string): PackageListFilters {
  return { page: 1, pageSize: 100, groupId, state: 'active' };
}

/** A lesson some list on screen already holds: the row that was clicked. */
function listedLesson(queryClient: QueryClient, lessonId: string): LessonResponse | undefined {
  for (const [, list] of queryClient.getQueriesData<LessonListResponse>({
    queryKey: queryKeys.lessons.listsAll,
  })) {
    const row = list?.items.find((item) => item.id === lessonId);
    if (row) return row;
  }
  return undefined;
}

/**
 * Starts the panel's second-level reads together with the lesson instead of
 * after it. The row that opened the panel already says whether the lesson is
 * a group's (the group, its attendance sheet, the members' packages) or one
 * student's (the direction's billing, the student); the teacher picker's list
 * needs neither. A lesson opened from a bare link waits for its detail, as before.
 */
export function usePrefetchLessonPanel(lessonId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!lessonId) return;
    void queryClient.prefetchQuery(teachersQueryOptions(TEACHER_OPTIONS_FILTERS));
    const row = listedLesson(queryClient, lessonId);
    if (row?.groupId) {
      void queryClient.prefetchQuery(groupQueryOptions(row.groupId));
      void queryClient.prefetchQuery(lessonAttendanceQueryOptions(lessonId));
      void queryClient.prefetchQuery(packagesQueryOptions(groupPackagesFilters(row.groupId)));
    } else if (row?.enrollmentId) {
      void queryClient.prefetchQuery(enrollmentBillingQueryOptions(row.enrollmentId));
      if (row.student) void queryClient.prefetchQuery(studentQueryOptions(row.student.id));
    }
  }, [lessonId, queryClient]);
}

export function useScheduleQuery(scheduleId: string | null) {
  return useQuery<ScheduleResponse, GatewayError>({
    queryKey: queryKeys.schedules.detail(scheduleId ?? ''),
    enabled: Boolean(scheduleId),
    queryFn: () => gatewayFetch<ScheduleResponse>(`/api/backend/schedules/${scheduleId}`),
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
    queryFn: () =>
      gatewayFetch<ScheduleChangePreview>(`/api/backend/schedules/${scheduleId}/changes/preview`, {
        method: 'POST',
        body: JSON.stringify(change),
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

// ---------------------------------------------------------------------------
// The lesson form (S02)
// ---------------------------------------------------------------------------

/** Every direction of a student with how it is paid (L-10, L-11): the form's price and package. */
export function useStudentBillingQuery(studentId: string | null) {
  return useQuery<StudentBillingResponse, GatewayError>({
    queryKey: ['students', 'billing', studentId ?? ''],
    enabled: Boolean(studentId),
    queryFn: () =>
      gatewayFetch<StudentBillingResponse>(`/api/backend/students/${studentId}/billing`),
  });
}

/** The active schedules of a student (optionally with one teacher) or of a group (L-20). */
export function useSchedulesQuery(
  filters: { studentId?: string; teacherId?: string; groupId?: string },
  enabled = true,
) {
  const query = new URLSearchParams({ page: '1', pageSize: '20', state: 'ACTIVE' });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return useQuery<ScheduleListResponse, GatewayError>({
    queryKey: [...queryKeys.schedules.all, 'list', filters],
    enabled,
    queryFn: () => gatewayFetch<ScheduleListResponse>(`/api/backend/schedules?${query}`),
  });
}

/** The pauses in force now, across the studio (L-100): who is on a break and until when. */
export function useCurrentPausesQuery(enabled = true) {
  return useQuery<PauseListResponse, GatewayError>({
    queryKey: ['pauses', 'current'],
    enabled,
    queryFn: () =>
      gatewayFetch<PauseListResponse>('/api/backend/pauses?page=1&pageSize=100&state=current'),
  });
}

/**
 * What creating a schedule would do (L-22, L-110): the lessons it generates at
 * once and what they overlap, before anything is written. A read, not a save.
 */
export function useScheduleCreatePreviewQuery(dto: CreateScheduleDto | null) {
  return useQuery<ScheduleCreatePreview, GatewayError>({
    queryKey: [...queryKeys.schedules.all, 'createPreview', dto],
    enabled: dto !== null,
    queryFn: () =>
      gatewayFetch<ScheduleCreatePreview>('/api/backend/schedules/preview', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  });
}

/** Books one or many lessons for one target (L-30, L-31); `force` after a conflict (L-111). */
export function useCreateLessonsMutation() {
  const queryClient = useQueryClient();
  return useMutation<LessonListResponse, GatewayError, { dto: CreateLessonDto; force?: boolean }>({
    mutationFn: ({ dto, force: forced }) =>
      gatewayFetch<LessonListResponse>(`/api/backend/lessons${force(forced)}`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

/** A new schedule for a student with a teacher or for a group (L-20…L-22). */
export function useCreateScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation<ScheduleResponse, GatewayError, { dto: CreateScheduleDto; force?: boolean }>({
    mutationFn: ({ dto, force: forced }) =>
      gatewayFetch<ScheduleResponse>(`/api/backend/schedules${force(forced)}`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

/** Changes an existing schedule from a date (L-23, L-25): "Repeat" adds a day to it. */
export function useApplyScheduleChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ScheduleChangeResult,
    GatewayError,
    { scheduleId: string; dto: ScheduleChangeDto; force?: boolean }
  >({
    mutationFn: ({ scheduleId, dto, force: forced }) =>
      gatewayFetch<ScheduleChangeResult>(
        `/api/backend/schedules/${scheduleId}/changes${force(forced)}`,
        { method: 'POST', body: JSON.stringify(dto) },
      ),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Bulk cancel (S04, L-54)
// ---------------------------------------------------------------------------

/** What a bulk cancel would call off, exactly as the apply would. A read, not a save. */
export function useBulkCancelPreviewMutation() {
  return useMutation<BulkCancelPreview, GatewayError, BulkCancelDto>({
    mutationFn: (dto) =>
      gatewayFetch<BulkCancelPreview>('/api/backend/lessons/bulk-cancel/preview', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  });
}

/** Cancels every scheduled lesson of the period, free and by the teacher (L-54). */
export function useBulkCancelMutation() {
  const queryClient = useQueryClient();
  return useMutation<BulkCancelResult, GatewayError, BulkCancelDto>({
    mutationFn: (dto) =>
      gatewayFetch<BulkCancelResult>('/api/backend/lessons/bulk-cancel', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Schedule change, stop and horizon (S05)
// ---------------------------------------------------------------------------

/** What stopping a schedule from a date would do (L-24). A read, not a save. */
export function useScheduleStopPreviewQuery(
  scheduleId: string | null,
  dto: StopScheduleDto | null,
) {
  return useQuery<ScheduleChangePreview, GatewayError>({
    queryKey: [...queryKeys.schedules.all, 'stopPreview', scheduleId, dto],
    enabled: Boolean(scheduleId && dto),
    placeholderData: (previous) => previous,
    queryFn: () =>
      gatewayFetch<ScheduleChangePreview>(`/api/backend/schedules/${scheduleId}/stop/preview`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  });
}

/** Stops a schedule from a date; its lessons from then on are removed (L-24). */
export function useStopScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ScheduleChangeResult,
    GatewayError,
    { scheduleId: string; dto: StopScheduleDto }
  >({
    mutationFn: ({ scheduleId, dto }) =>
      gatewayFetch<ScheduleChangeResult>(`/api/backend/schedules/${scheduleId}/stop`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}

/** What a new horizon would add (L-22). A read, not a save. */
export function useScheduleHorizonPreviewQuery(
  scheduleId: string | null,
  horizonWeeks: number | null,
) {
  return useQuery<ScheduleHorizonPreview, GatewayError>({
    queryKey: [...queryKeys.schedules.all, 'horizonPreview', scheduleId, horizonWeeks],
    enabled: Boolean(scheduleId && horizonWeeks),
    placeholderData: (previous) => previous,
    queryFn: () =>
      gatewayFetch<ScheduleHorizonPreview>(`/api/backend/schedules/${scheduleId}/horizon/preview`, {
        method: 'POST',
        body: JSON.stringify({ horizonWeeks }),
      }),
  });
}

/** Sets how many weeks ahead a schedule keeps its lessons (L-22). */
export function useUpdateScheduleHorizonMutation() {
  const queryClient = useQueryClient();
  return useMutation<ScheduleResponse, GatewayError, { scheduleId: string; horizonWeeks: number }>({
    mutationFn: ({ scheduleId, horizonWeeks }) =>
      gatewayFetch<ScheduleResponse>(`/api/backend/schedules/${scheduleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ horizonWeeks }),
      }),
    onSuccess: () => invalidateLessonGraph(queryClient),
  });
}
