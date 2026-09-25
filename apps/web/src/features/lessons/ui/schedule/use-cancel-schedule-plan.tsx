'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ScheduleResponse } from '@tutorio/validation';
import { useCancelSchedulePlanMutation } from '../../api';
import { useConflictGuard } from '../dialogs/use-conflict-guard';
import { scheduleWho } from './schedule-change-dialog';

/** What a schedule has planned for later: a change of days or times, or a stop. */
export type SchedulePlan = 'change' | 'stop';

/**
 * «Скасувати зміну» and «Скасувати зупинку» (S08): take back a schedule's
 * planned change or stop at once. A lesson coming back onto a taken time
 * opens the conflict dialog with «Зберегти попри накладку» (L-111). The
 * caller renders `dialog` once.
 */
export function useCancelSchedulePlan() {
  const t = useTranslations('schedules');
  const mutation = useCancelSchedulePlanMutation();
  const guard = useConflictGuard();

  const cancel = (schedule: ScheduleResponse, plan: SchedulePlan) =>
    guard.run(
      (conflicts) => ({
        startsAtUtc:
          conflicts[0]?.candidateStartsAtUtc ??
          (plan === 'stop' ? schedule.endsAt : schedule.nextChange?.effectiveFrom) ??
          '',
        durationMin: schedule.durationMin,
        title: scheduleWho(schedule),
        teacherName: schedule.teacher.name,
      }),
      async (force) => {
        await mutation.mutateAsync({ scheduleId: schedule.id, plan, force });
      },
      () => toast.success(plan === 'stop' ? t('cancelStop.done') : t('cancelChange.done')),
    );

  return {
    cancel,
    pending: mutation.isPending ? (mutation.variables?.plan ?? null) : null,
    dialog: guard.dialog,
  };
}
