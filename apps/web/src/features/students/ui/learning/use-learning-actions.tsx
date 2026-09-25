'use client';

import { useState } from 'react';
import { ArchiveIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { PauseResponse, ScheduleResponse } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ScheduleChangeDialog, ScheduleCreateDialog } from '@/features/lessons';
import { PackageSaleDialog } from '@/features/packages';
import { useUpdateDirectionMutation } from '@/features/students/api';
import { directionName, type BillingDirection } from '@/features/students/model/learning';
import { useBillingErrorToast } from './dialog-parts';
import { DirectionSettingsDialog } from './direction-settings-dialog';
import { PauseDialog } from './pause-dialog';
import { PauseEndDialog } from './pause-end-dialog';
import { PaymentDialog } from './payment-dialog';

type Open =
  | { kind: 'pay'; enrollmentId: string }
  | { kind: 'sell'; enrollmentId: string | null }
  | { kind: 'settings'; enrollmentId: string }
  | { kind: 'pause'; enrollmentId: string | null; pause: PauseResponse | null }
  | { kind: 'end'; pause: PauseResponse }
  | { kind: 'endDirection'; enrollmentId: string }
  | { kind: 'scheduleChange'; schedule: ScheduleResponse }
  | { kind: 'scheduleCreate'; initial: { studentId?: string; groupId?: string } }
  | null;

/**
 * Every action of the «Навчання й оплата» block, its banners, the status
 * control and the tabs, in one place: which dialog is open and the dialogs
 * themselves. The caller renders `dialogs` once.
 */
export function useLearningActions({
  student,
  directions,
  studioDeadlineHours,
}: {
  student: { id: string; fullName: string };
  /** The live directions, with how each is paid; empty while the read loads. */
  directions: readonly BillingDirection[];
  studioDeadlineHours: number;
}) {
  const t = useTranslations('students.learningBlock');
  const [open, setOpen] = useState<Open>(null);
  const update = useUpdateDirectionMutation();
  const showError = useBillingErrorToast();
  const byId = (id: string) =>
    directions.find((direction) => direction.enrollmentId === id) ?? null;
  const close = () => setOpen(null);

  const payDirection = open?.kind === 'pay' ? byId(open.enrollmentId) : null;
  const settingsDirection = open?.kind === 'settings' ? byId(open.enrollmentId) : null;
  const endingDirection = open?.kind === 'endDirection' ? byId(open.enrollmentId) : null;
  const liveDirections = directions.filter((direction) => direction.status !== 'ARCHIVED');

  const endDirection = () => {
    if (!endingDirection) return;
    update.mutate(
      { enrollmentId: endingDirection.enrollmentId, dto: { status: 'ARCHIVED' } },
      {
        onSuccess: () => {
          toast.success(t('ended', { name: directionName(endingDirection) }));
          close();
        },
        onError: showError,
      },
    );
  };

  const dialogs = (
    <>
      {payDirection ? (
        <PaymentDialog
          open
          onOpenChange={(next) => (next ? undefined : close())}
          studentName={student.fullName}
          direction={payDirection}
        />
      ) : null}
      {open?.kind === 'sell' ? (
        <PackageSaleDialog
          open
          onOpenChange={(next) => (next ? undefined : close())}
          studentId={student.id}
          enrollmentId={open.enrollmentId ?? undefined}
        />
      ) : null}
      {settingsDirection ? (
        <DirectionSettingsDialog
          open
          onOpenChange={(next) => (next ? undefined : close())}
          studentName={student.fullName}
          direction={settingsDirection}
          studioDeadlineHours={studioDeadlineHours}
        />
      ) : null}
      <PauseDialog
        open={open?.kind === 'pause'}
        onOpenChange={(next) => (next ? undefined : close())}
        student={student}
        directions={liveDirections}
        enrollmentId={open?.kind === 'pause' ? open.enrollmentId : null}
        pause={open?.kind === 'pause' ? open.pause : null}
      />
      <PauseEndDialog
        open={open?.kind === 'end'}
        onOpenChange={(next) => (next ? undefined : close())}
        pause={open?.kind === 'end' ? open.pause : null}
        student={student}
        directionNames={
          new Map(directions.map((direction) => [direction.enrollmentId, directionName(direction)]))
        }
      />
      <ConfirmDialog
        open={Boolean(endingDirection)}
        onOpenChange={(next) => (next ? undefined : close())}
        tone="danger"
        icon={<ArchiveIcon />}
        title={t('endTitle')}
        description={
          endingDirection
            ? t('endText', { name: directionName(endingDirection), student: student.fullName })
            : ''
        }
        confirmLabel={t('endConfirm')}
        pending={update.isPending}
        onConfirm={endDirection}
      />
      {open?.kind === 'scheduleChange' ? (
        <ScheduleChangeDialog
          open
          onOpenChange={(next) => (next ? undefined : close())}
          schedule={open.schedule}
        />
      ) : null}
      {open?.kind === 'scheduleCreate' ? (
        <ScheduleCreateDialog
          open
          onOpenChange={(next) => (next ? undefined : close())}
          initial={open.initial}
        />
      ) : null}
    </>
  );

  return {
    dialogs,
    pay: (enrollmentId: string) => setOpen({ kind: 'pay', enrollmentId }),
    /** «Продати пакет» (S07): a direction's, or the first package direction's. */
    sell: (enrollmentId: string | null = null) =>
      setOpen({
        kind: 'sell',
        enrollmentId:
          enrollmentId ??
          liveDirections.find((direction) => direction.billingType === 'PACKAGE')?.enrollmentId ??
          null,
      }),
    settings: (enrollmentId: string) => setOpen({ kind: 'settings', enrollmentId }),
    /** A new pause: the whole student, or the direction it was opened from. */
    pause: (enrollmentId: string | null = null) =>
      setOpen({ kind: 'pause', enrollmentId, pause: null }),
    changePause: (pause: PauseResponse) =>
      setOpen({ kind: 'pause', enrollmentId: pause.enrollmentId, pause }),
    /** Return now from a running pause, or cancel one that has not begun. */
    endPause: (pause: PauseResponse) => setOpen({ kind: 'end', pause }),
    endDirection: (enrollmentId: string) => setOpen({ kind: 'endDirection', enrollmentId }),
    /** The direction's schedule: its change, or a new one when it has none. */
    schedule: (direction: BillingDirection, schedule: ScheduleResponse | null) =>
      setOpen(
        schedule
          ? { kind: 'scheduleChange', schedule }
          : {
              kind: 'scheduleCreate',
              initial: direction.group
                ? { groupId: direction.group.id }
                : { studentId: student.id },
            },
      ),
    /** «+ Напрям»: a new schedule opens a direction with a teacher (L-2). */
    newDirection: () => setOpen({ kind: 'scheduleCreate', initial: { studentId: student.id } }),
  };
}

export type LearningActions = ReturnType<typeof useLearningActions>;
