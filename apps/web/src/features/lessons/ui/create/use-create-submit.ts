'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ScheduleChangeDto, ScheduleResponse } from '@tutorio/validation';
import {
  useApplyScheduleChangeMutation,
  useCreateLessonsMutation,
  useCreateScheduleMutation,
  useScheduleChangePreviewQuery,
} from '../../api';
import {
  createLessonRequests,
  createScheduleDto,
  scheduleChangeDto,
  type CreateFormValues,
} from '../../model/create';
import type { ConflictCandidate } from '../dialogs/conflict-dialog';
import { useConflictGuard } from '../dialogs/use-conflict-guard';
import type { CreateData } from './use-create-data';

export type CreateSubmitContext = {
  values: CreateFormValues;
  data: CreateData;
  /** The direction's or group's schedule «Щотижня» adds to (L-23). */
  existing: ScheduleResponse | null;
  now: number;
  /** The price each lesson carries (a package lesson keeps the direction's rate). */
  priceMinor: number;
  currency: string;
  /** The first lesson as the conflict dialog shows it. */
  candidate: ConflictCandidate;
  count: number;
};

/** What adding the days to the schedule would do (L-25), for «Що буде». */
export function useApplyScheduleChangePreview(
  scheduleId: string | null,
  change: ScheduleChangeDto | null,
) {
  return useScheduleChangePreviewQuery(scheduleId, change);
}

/**
 * Saves the lesson form: the one-off dates (`POST /lessons`, the dates ahead
 * and the past ones apart, L-31), a new schedule (`POST /schedules`) or the
 * days added to the existing one (`POST /schedules/:id/changes`). A conflict
 * opens the S01 conflict dialog, whose «Зберегти все одно» repeats what is
 * left of the save with `force` (L-111).
 */
export function useCreateSubmit({ onSaved }: { onSaved: (message: string) => void }) {
  const t = useTranslations('lessons.create');
  const guard = useConflictGuard();
  const createLessons = useCreateLessonsMutation();
  const createSchedule = useCreateScheduleMutation();
  const applyChange = useApplyScheduleChangeMutation();

  const run = async (context: CreateSubmitContext) => {
    const { values, data, existing, candidate } = context;

    if (values.frequency === 'weekly') {
      if (existing) {
        const dto = scheduleChangeDto(values, existing.slots);
        return guard.run(
          candidate,
          async (force) => {
            await applyChange.mutateAsync({ scheduleId: existing.id, dto, force });
          },
          () => onSaved(t('scheduleUpdated')),
        );
      }
      const dto = createScheduleDto(values, {
        priceMinor: data.priceMode === 'amount' ? context.priceMinor : null,
        currency: context.currency,
      });
      return guard.run(
        candidate,
        async (force) => {
          await createSchedule.mutateAsync({ dto, force });
        },
        () => onSaved(t('scheduleCreated')),
      );
    }

    const target = data.group?.target ?? data.booking?.target;
    if (!target) return;
    const requests = createLessonRequests(values, {
      target,
      priceMinor: context.priceMinor,
      currency: context.currency,
      now: Date.now(),
    });
    // A retry with `force` books only what the first attempt did not.
    let done = 0;
    return guard.run(
      candidate,
      async (force) => {
        while (done < requests.length) {
          await createLessons.mutateAsync({ dto: requests[done]!, force });
          done += 1;
        }
      },
      () => onSaved(t('created', { count: context.count })),
    );
  };

  const busy = createLessons.isPending || createSchedule.isPending || applyChange.isPending;
  const dialog: ReactNode = guard.dialog;
  return { run, busy, dialog };
}
