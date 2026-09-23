'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LessonAttendanceResponse, SetLessonAttendanceDto } from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { queryKeys } from './keys';

/** A lesson's participants and the mark each of them has so far. */
export function useLessonAttendanceQuery(lessonId: string, enabled = true) {
  return useQuery<LessonAttendanceResponse, GatewayError>({
    queryKey: queryKeys.lessons.attendance(lessonId),
    enabled: enabled && Boolean(lessonId),
    queryFn: ({ signal }) =>
      gatewayFetch<LessonAttendanceResponse>(`/api/backend/lessons/${lessonId}/attendance`, {
        signal,
      }),
  });
}

/**
 * Sets marks for one lesson. The lesson rows report "present of marked" and
 * the group sheet summarizes the marks, so both refresh; nothing else moves.
 */
export function useSetLessonAttendanceMutation(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation<LessonAttendanceResponse, GatewayError, SetLessonAttendanceDto>({
    mutationFn: (dto) =>
      gatewayFetch<LessonAttendanceResponse>(`/api/backend/lessons/${lessonId}/attendance`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      }),
    onSuccess: (sheet) => {
      queryClient.setQueryData(queryKeys.lessons.attendance(lessonId), sheet);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.listsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.attendanceAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all, refetchType: 'none' });
    },
  });
}
