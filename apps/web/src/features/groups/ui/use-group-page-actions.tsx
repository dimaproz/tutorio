'use client';

import { useState } from 'react';
import type { GroupDetail, GroupEnrollmentSummary, ScheduleResponse } from '@tutorio/validation';
import {
  ScheduleChangeDialog,
  ScheduleCreateDialog,
  ScheduleStopDialog,
  useCancelScheduleChange,
} from '@/features/lessons';
import { MemberSaleDialog, PackageSaleDialog, type MemberBillingState } from '@/features/packages';
import { DirectionPauseEndDialog, DirectionPaymentDialog } from '@/features/students';
import type { MemberAction } from './group-member-card';
import type { ScheduleCardActions } from './group-schedule-card';
import { saleCandidates } from './use-member-states';

type Open =
  | { kind: 'scheduleCreate' }
  | { kind: 'scheduleChange' }
  | { kind: 'scheduleStop' }
  | { kind: 'sale' }
  | { kind: MemberAction; member: GroupEnrollmentSummary }
  | null;

/**
 * Every S08 command of the group page in one place: the schedule card's
 * (create, change, add a day, stop — the S05 dialogs — and cancel a planned
 * change), the member cards' (record a payment and bring back — the S06
 * dialogs —, sell one package — the S07 sale) and the group sale. The caller
 * renders `dialogs` once.
 */
export function useGroupPageActions({
  group,
  schedule,
  states,
  now,
}: {
  group: GroupDetail;
  schedule: ScheduleResponse | null;
  states: ReadonlyMap<string, MemberBillingState>;
  now: number;
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const cancelChange = useCancelScheduleChange();

  const scheduleActions: ScheduleCardActions = {
    onCreate: () => setOpen({ kind: 'scheduleCreate' }),
    onChange: () => setOpen({ kind: 'scheduleChange' }),
    // A day is added through the change dialog, which shows what it becomes (L-23).
    onAddDay: () => setOpen({ kind: 'scheduleChange' }),
    onStop: () => setOpen({ kind: 'scheduleStop' }),
    onCancelChange: () => {
      if (schedule) void cancelChange.cancel(schedule);
    },
    cancelling: cancelChange.pending,
  };

  const candidates = saleCandidates(group, states);
  const byName = (a: { fullName: string }, b: { fullName: string }) =>
    a.fullName.localeCompare(b.fullName);
  const orderedCandidates = [
    ...candidates
      .filter((row) => ['debt', 'low', 'noPackage'].includes(row.state.kind))
      .sort(byName),
    ...candidates
      .filter((row) => !['debt', 'low', 'noPackage', 'paused'].includes(row.state.kind))
      .sort(byName),
    ...candidates.filter((row) => row.state.kind === 'paused').sort(byName),
  ];
  const student = (member: GroupEnrollmentSummary) => ({
    id: member.studentId,
    fullName: member.student.fullName,
  });

  const dialogs = (
    <>
      <ScheduleCreateDialog
        open={open?.kind === 'scheduleCreate'}
        onOpenChange={(next) => (next ? undefined : close())}
        initial={{ groupId: group.id }}
        nowMs={now}
      />
      {schedule ? (
        <>
          <ScheduleChangeDialog
            open={open?.kind === 'scheduleChange'}
            onOpenChange={(next) => (next ? undefined : close())}
            schedule={schedule}
            nowMs={now}
          />
          <ScheduleStopDialog
            open={open?.kind === 'scheduleStop'}
            onOpenChange={(next) => (next ? undefined : close())}
            schedule={schedule}
            nowMs={now}
          />
        </>
      ) : null}
      {cancelChange.dialog}
      <MemberSaleDialog
        open={open?.kind === 'sale'}
        onOpenChange={(next) => (next ? undefined : close())}
        group={{
          id: group.id,
          name: group.name,
          teacherName: group.teacher?.name ?? '',
          priceMinor: group.pricePerLesson,
          currency: group.currency ?? group.enrollments[0]?.currency ?? 'UAH',
        }}
        candidates={orderedCandidates}
        schedule={schedule}
        nowMs={now}
      />
      {open?.kind === 'sell' ? (
        <PackageSaleDialog
          open
          onOpenChange={(next) => (next ? undefined : close())}
          studentId={open.member.studentId}
          enrollmentId={open.member.id}
          nowMs={now}
        />
      ) : null}
      {open?.kind === 'pay' ? (
        <DirectionPaymentDialog
          student={student(open.member)}
          enrollmentId={open.member.id}
          onClose={close}
        />
      ) : null}
      {open?.kind === 'return' ? (
        <DirectionPauseEndDialog
          student={student(open.member)}
          enrollmentId={open.member.id}
          onClose={close}
        />
      ) : null}
    </>
  );

  return {
    scheduleActions,
    onMemberAction: (action: MemberAction, member: GroupEnrollmentSummary) =>
      setOpen({ kind: action, member }),
    onSellToMembers: candidates.length > 0 ? () => setOpen({ kind: 'sale' }) : undefined,
    dialogs,
  };
}
