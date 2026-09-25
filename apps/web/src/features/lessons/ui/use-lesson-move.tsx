'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type {
  LessonDetailResponse,
  LessonResponse,
  RescheduleLessonDto,
  RescheduleScopeDto,
  ScheduleResponse,
} from '@tutorio/validation';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { MoveDialog } from './dialogs/move-dialog';
import { useConflictGuard } from './dialogs/use-conflict-guard';
import { useErrorToast } from './lesson-form-parts';
import { useLessonDates } from './lesson-format';

/** What the calendar hands over for a drop: the lesson and its new start. */
export type LessonMoveSource = Pick<
  LessonResponse,
  'id' | 'startsAtUtc' | 'durationMin' | 'seriesId' | 'isDetached' | 'student' | 'group' | 'teacher'
>;

type Asking = {
  lesson: LessonDetailResponse;
  schedule: ScheduleResponse;
  target: { startsAtUtc: string };
};

/**
 * Moving a lesson by a drop (S03), with the S01 rules: a lesson of an active
 * schedule asks «Лише це / Це і наступні» first (L-41); every save goes
 * through the conflict dialog with «Зберегти все одно» (L-110, L-111); a
 * plain move applies at once and its toast offers to undo it.
 */
export function useLessonMove() {
  const t = useTranslations('lessons.move');
  const dates = useLessonDates();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const guard = useConflictGuard();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [preparing, setPreparing] = useState(false);
  const reschedule = useMutation<
    LessonResponse,
    GatewayError,
    { lessonId: string; dto: RescheduleLessonDto; force: boolean }
  >({
    mutationFn: ({ lessonId, dto, force }) =>
      gatewayFetch<LessonResponse>(
        `/api/backend/lessons/${lessonId}/reschedule${force ? '?force=true' : ''}`,
        { method: 'PATCH', body: JSON.stringify(dto) },
      ),
    onSuccess: () => {
      for (const queryKey of [
        queryKeys.lessons.all,
        queryKeys.series.all,
        queryKeys.schedules.all,
        queryKeys.groups.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const save = (
    lesson: LessonMoveSource,
    startsAtUtc: string,
    scope: RescheduleScopeDto,
    onSaved: () => void,
  ) =>
    guard.run(
      {
        startsAtUtc,
        durationMin: lesson.durationMin,
        title: lesson.student?.fullName ?? lesson.group?.name ?? '',
        teacherName: lesson.teacher.name,
      },
      (force) =>
        reschedule
          .mutateAsync({ lessonId: lesson.id, dto: { startsAtUtc, scope }, force })
          .then(() => undefined),
      onSaved,
    );

  const movedText = (lesson: LessonMoveSource, startsAtUtc: string) =>
    t('movedToast', {
      name: lesson.student?.fullName ?? lesson.group?.name ?? '',
      date: dates.longDay(startsAtUtc),
      time: dates.time(startsAtUtc),
    });

  const move = async (lesson: LessonMoveSource, target: { startsAtUtc: string }) => {
    if (target.startsAtUtc === lesson.startsAtUtc) return;
    if (lesson.seriesId && !lesson.isDetached) {
      setPreparing(true);
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: queryKeys.lessons.detail(lesson.id),
          queryFn: () => gatewayFetch<LessonDetailResponse>(`/api/backend/lessons/${lesson.id}`),
        });
        if (detail.schedule?.state === 'ACTIVE') {
          const schedule = await queryClient.fetchQuery({
            queryKey: queryKeys.schedules.detail(detail.schedule.id),
            queryFn: () =>
              gatewayFetch<ScheduleResponse>(`/api/backend/schedules/${detail.schedule!.id}`),
          });
          setAsking({ lesson: detail, schedule, target });
          return;
        }
      } catch (error) {
        showError(error);
        return;
      } finally {
        setPreparing(false);
      }
    }
    const from = lesson.startsAtUtc;
    await save(lesson, target.startsAtUtc, 'this', () => {
      toast.success(movedText(lesson, target.startsAtUtc), {
        action: {
          label: t('undo'),
          onClick: () =>
            void save({ ...lesson, startsAtUtc: target.startsAtUtc }, from, 'this', () =>
              toast.success(t('undone')),
            ),
        },
      });
    });
  };

  const dialogs = (
    <>
      {asking ? (
        <MoveDialog
          lesson={asking.lesson}
          schedule={asking.schedule}
          target={asking.target}
          defaultScope="this"
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null);
          }}
          busy={reschedule.isPending}
          onConfirm={(scope) =>
            void save(asking.lesson, asking.target.startsAtUtc, scope, () => {
              setAsking(null);
              toast.success(movedText(asking.lesson, asking.target.startsAtUtc));
            })
          }
        />
      ) : null}
      {guard.dialog}
    </>
  );

  return { move, dialogs, pending: preparing || reschedule.isPending };
}
