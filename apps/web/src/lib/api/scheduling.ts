'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  CreateLessonDto,
  CreateLessonSeriesDto,
  LessonListResponse,
  LessonResponse,
  LessonSeriesListResponse,
  LessonSeriesResponse,
  RescheduleLessonDto,
  TransitionLessonDto,
  UpdateLessonSeriesDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type LessonListFilters, type SeriesListFilters } from './keys';

// Lessons, series and the audit trail all move together on any scheduling
// mutation, so every mutation invalidates the whole scheduling graph.
function invalidateSchedulingGraph(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.series.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export function useLessonsQuery(filters: LessonListFilters, enabled = true) {
  return useQuery<LessonListResponse, GatewayError>({
    queryKey: queryKeys.lessons.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<LessonListResponse>(
        `/api/backend/lessons${buildQueryString({
          from: filters.from,
          to: filters.to,
          teacherId: filters.teacherId,
          enrollmentId: filters.enrollmentId,
          groupId: filters.groupId,
          status: filters.status,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useCreateLessonMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    LessonListResponse,
    GatewayError,
    { dto: CreateLessonDto; force?: boolean }
  >({
    mutationFn: ({ dto, force }) =>
      gatewayFetch<LessonListResponse>(
        `/api/backend/lessons${force ? '?force=true' : ''}`,
        { method: 'POST', body: JSON.stringify(dto) },
      ),
    onSuccess: () => invalidateSchedulingGraph(queryClient),
  });
}

export function useRescheduleLessonMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    LessonResponse,
    GatewayError,
    { lessonId: string; dto: RescheduleLessonDto; force?: boolean }
  >({
    mutationFn: ({ lessonId, dto, force }) =>
      gatewayFetch<LessonResponse>(
        `/api/backend/lessons/${lessonId}/reschedule${force ? '?force=true' : ''}`,
        { method: 'PATCH', body: JSON.stringify(dto) },
      ),
    onSuccess: () => invalidateSchedulingGraph(queryClient),
  });
}

export function useTransitionLessonMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    LessonResponse,
    GatewayError,
    { lessonId: string; dto: TransitionLessonDto }
  >({
    mutationFn: ({ lessonId, dto }) =>
      gatewayFetch<LessonResponse>(`/api/backend/lessons/${lessonId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateSchedulingGraph(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Series (recurring patterns)
// ---------------------------------------------------------------------------

export function useSeriesListQuery(filters: SeriesListFilters, enabled = true) {
  return useQuery<LessonSeriesListResponse, GatewayError>({
    queryKey: queryKeys.series.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<LessonSeriesListResponse>(
        `/api/backend/lesson-series${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          enrollmentId: filters.enrollmentId,
          groupId: filters.groupId,
          teacherId: filters.teacherId,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useCreateSeriesMutation() {
  const queryClient = useQueryClient();
  return useMutation<LessonSeriesResponse, GatewayError, CreateLessonSeriesDto>({
    mutationFn: (dto) =>
      gatewayFetch<LessonSeriesResponse>('/api/backend/lesson-series', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateSchedulingGraph(queryClient),
  });
}

export function useUpdateSeriesMutation(seriesId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonSeriesResponse, GatewayError, UpdateLessonSeriesDto>({
    mutationFn: (dto) =>
      gatewayFetch<LessonSeriesResponse>(`/api/backend/lesson-series/${seriesId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateSchedulingGraph(queryClient),
  });
}

export function useDeleteSeriesMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (seriesId) =>
      gatewayFetch<void>(`/api/backend/lesson-series/${seriesId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateSchedulingGraph(queryClient),
  });
}
