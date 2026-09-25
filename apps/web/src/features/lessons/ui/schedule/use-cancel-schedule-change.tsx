'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ScheduleResponse } from '@tutorio/validation';
import { useCancelScheduleChangeMutation } from '../../api';
import { useConflictGuard } from '../dialogs/use-conflict-guard';
import { scheduleWho } from './schedule-change-dialog';

/**
 * «Скасувати зміну» (S08): takes back a schedule's planned change at once.
 * A lesson moving back onto a taken time opens the conflict dialog with
 * «Зберегти попри накладку» (L-111). The caller renders `dialog` once.
 */
export function useCancelScheduleChange() {
  const t = useTranslations('schedules.cancelChange');
  const mutation = useCancelScheduleChangeMutation();
  const guard = useConflictGuard();

  const cancel = (schedule: ScheduleResponse) =>
    guard.run(
      (conflicts) => ({
        startsAtUtc: conflicts[0]?.candidateStartsAtUtc ?? schedule.nextChange?.effectiveFrom ?? '',
        durationMin: schedule.durationMin,
        title: scheduleWho(schedule),
        teacherName: schedule.teacher.name,
      }),
      async (force) => {
        await mutation.mutateAsync({ scheduleId: schedule.id, force });
      },
      () => toast.success(t('done')),
    );

  return { cancel, pending: mutation.isPending, dialog: guard.dialog };
}
