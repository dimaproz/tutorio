'use client';

import { useStudentBillingQuery, useStudentPausesQuery } from '@/features/students/api';
import { PauseEndDialog } from './pause-end-dialog';
import { PaymentDialog } from './payment-dialog';

/**
 * «Записати оплату» for one direction of a student, from outside the profile
 * (the group page's member card, S08): the S06 payment dialog once the
 * student's billing is read.
 */
export function DirectionPaymentDialog({
  student,
  enrollmentId,
  onClose,
}: {
  student: { id: string; fullName: string };
  enrollmentId: string;
  onClose: () => void;
}) {
  const billing = useStudentBillingQuery(student.id);
  const direction = billing.data?.directions.find((row) => row.enrollmentId === enrollmentId);
  return direction ? (
    <PaymentDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      studentName={student.fullName}
      direction={direction}
    />
  ) : null;
}

/**
 * «Повернути» a paused member from outside the profile (S08): the S06
 * return dialog for the pause that covers this direction — the direction's
 * own, else the whole student's.
 */
export function DirectionPauseEndDialog({
  student,
  enrollmentId,
  onClose,
}: {
  student: { id: string; fullName: string };
  enrollmentId: string;
  onClose: () => void;
}) {
  const pauses = useStudentPausesQuery(student.id);
  const items = pauses.data?.items ?? [];
  const pause =
    items.find((row) => row.enrollmentId === enrollmentId) ??
    items.find((row) => row.enrollmentId === null) ??
    null;
  return (
    <PauseEndDialog
      open={pause !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      pause={pause}
      student={student}
    />
  );
}

/**
 * «Повернути» one pause from outside the profile (the Today page, S11): the
 * S06 return dialog for that pause once the student's pauses are read.
 */
export function StudentPauseEndDialog({
  student,
  pauseId,
  onClose,
}: {
  student: { id: string; fullName: string };
  pauseId: string;
  onClose: () => void;
}) {
  const pauses = useStudentPausesQuery(student.id);
  const pause = pauses.data?.items.find((row) => row.id === pauseId) ?? null;
  return (
    <PauseEndDialog
      open={pause !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      pause={pause}
      student={student}
    />
  );
}
