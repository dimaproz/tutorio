'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArchiveIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentStatusDto } from '@tutorio/validation';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  StatusMenuContent,
  StatusSheet,
  type StatusOption,
} from '@/components/shared/status-options';
import {
  StatusTrigger,
  type LifecycleTone,
  type StatusTriggerSize,
} from '@/components/shared/status-trigger';
import { useIsMobile } from '@/hooks/use-mobile';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import {
  useArchiveStudentMutation,
  useRestoreStudentMutation,
  useUpdateStudentMutation,
} from '@/lib/api/students';
import { studentStatusTransition } from '@/features/students/model/lifecycle';
import { useStudentBillingQuery, useStudentPausesQuery } from '@/features/students/api';
import { visibleDirections } from '@/features/students/model/learning';
import { PauseDialog } from './learning/pause-dialog';
import { PauseEndDialog } from './learning/pause-end-dialog';

export const STUDENT_STATUS_TONE: Record<StudentStatusDto, LifecycleTone> = {
  ACTIVE: 'active',
  ON_HOLD: 'hold',
  ARCHIVED: 'archived',
};

const STATUS_ICON: Record<StudentStatusDto, ReactNode> = {
  ACTIVE: <PlayIcon />,
  ON_HOLD: <PauseIcon />,
  ARCHIVED: <ArchiveIcon />,
};

const STATUSES: StudentStatusDto[] = ['ACTIVE', 'ON_HOLD', 'ARCHIVED'];

export type StatusControlStudent = { id: string; fullName: string; status: StudentStatusDto };

export function useStudentStatusOptionList(
  current: StudentStatusDto,
): StatusOption<StudentStatusDto>[] {
  const t = useTranslations('students.status');
  return useMemo(
    () =>
      STATUSES.map((value) => ({
        value,
        label: t(`${value}.label`),
        description: t(`${value}.description`),
        icon: STATUS_ICON[value],
        tone: STUDENT_STATUS_TONE[value],
        disabled: studentStatusTransition(current, value).kind === 'unavailable',
      })),
    [t, current],
  );
}

/** How the status control starts and ends a pause, when the page owns the pause dialogs. */
export type StatusPauseActions = {
  /** «На паузі»: the pause dialog for the whole student. */
  pause: () => void;
  /**
   * «Активний» from a pause: the return dialog of the running whole-student
   * pause; false when there is none to end, so the status changes at once.
   */
  returnNow: () => boolean;
};

/**
 * Every student status change in one place: «На паузі» opens the pause
 * dialog with dates (L-100…L-104, S06 decision 8), «Активний» from a pause
 * the return dialog, the archive its confirmation, and the restore applies at
 * once. A page that owns the pause dialogs (the profile) passes them in;
 * elsewhere the control brings its own. Status changes save on their own and
 * never touch an open form.
 */
export function useStudentStatusActions(
  student: StatusControlStudent,
  pauseActions?: StatusPauseActions,
) {
  const t = useTranslations('students');
  const tErrors = useTranslations('errors');
  const [archiving, setArchiving] = useState(false);
  const update = useUpdateStudentMutation(student.id);
  const archive = useArchiveStudentMutation();
  const restore = useRestoreStudentMutation();
  const own = useOwnPauseDialogs(student, !pauseActions);
  const pausing = pauseActions ?? own;
  const firstName = student.fullName.split(/\s+/)[0] || student.fullName;
  const fail = (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));

  const choose = (next: StudentStatusDto) => {
    const change = studentStatusTransition(student.status, next);
    if (change.kind === 'hold') pausing.pause();
    if (change.kind === 'archive') setArchiving(true);
    if (change.kind === 'reactivate' && !pausing.returnNow()) {
      update.mutate(
        { status: 'ACTIVE' },
        {
          onSuccess: () => toast.success(t('toasts.reactivatedName', { name: firstName })),
          onError: fail,
        },
      );
    }
    if (change.kind === 'restore') {
      restore.mutate(student.id, {
        onSuccess: () => toast.success(t('toasts.restored')),
        onError: fail,
      });
    }
  };

  const confirmArchive = () =>
    archive.mutate(student.id, {
      onSuccess: () => {
        setArchiving(false);
        toast.success(t('toasts.archived'));
      },
      onError: fail,
    });

  const dialogs = (
    <>
      {own.dialogs}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        tone="danger"
        icon={<ArchiveIcon />}
        title={t('archiveDialog.title')}
        description={t('archiveDialog.description', { name: student.fullName })}
        confirmLabel={t('archiveDialog.action')}
        pending={archive.isPending}
        onConfirm={confirmArchive}
      />
    </>
  );

  return {
    choose,
    dialogs,
    pending: update.isPending || archive.isPending || restore.isPending,
  };
}

/**
 * The pause and return dialogs of a status control that stands alone (the
 * edit page): the student's directions and pauses are read only once needed.
 */
function useOwnPauseDialogs(student: StatusControlStudent, enabled: boolean) {
  const [open, setOpen] = useState<'pause' | 'return' | null>(null);
  const billing = useStudentBillingQuery(student.id, enabled && open === 'pause');
  const pauses = useStudentPausesQuery(student.id, enabled && student.status === 'ON_HOLD');
  const running =
    pauses.data?.items.find((item) => item.enrollmentId === null && item.state === 'ACTIVE') ??
    null;
  const close = (next: boolean) => (next ? undefined : setOpen(null));

  return {
    pause: () => setOpen('pause'),
    returnNow: () => {
      if (!running) return false;
      setOpen('return');
      return true;
    },
    dialogs: enabled ? (
      <>
        <PauseDialog
          open={open === 'pause' && Boolean(billing.data)}
          onOpenChange={close}
          student={student}
          directions={visibleDirections(billing.data?.directions ?? []).filter(
            (direction) => direction.status !== 'ARCHIVED',
          )}
        />
        <PauseEndDialog
          open={open === 'return'}
          onOpenChange={close}
          pause={running}
          student={student}
        />
      </>
    ) : null,
  };
}

export type StudentStatusActions = ReturnType<typeof useStudentStatusActions>;

/**
 * The student status pill: a dropdown on desktop and a bottom sheet on
 * phones, both listing the three statuses with what each one means. Pass
 * `actions` when another control on the page (a banner) changes the status
 * too, so both share one set of dialogs; the caller then renders
 * `actions.dialogs` once.
 */
export function StudentStatusControl({
  student,
  size = 'sm',
  note,
  actions,
}: {
  student: StatusControlStudent;
  size?: StatusTriggerSize;
  /** Extra context under the options, e.g. that the change saves on its own. */
  note?: ReactNode;
  actions?: StudentStatusActions;
}) {
  if (actions) {
    return <StudentStatusMenu student={student} size={size} note={note} actions={actions} />;
  }
  return <OwnStatusControl student={student} size={size} note={note} />;
}

function OwnStatusControl(props: {
  student: StatusControlStudent;
  size: StatusTriggerSize;
  note?: ReactNode;
}) {
  const actions = useStudentStatusActions(props.student);
  return (
    <>
      <StudentStatusMenu {...props} actions={actions} />
      {actions.dialogs}
    </>
  );
}

function StudentStatusMenu({
  student,
  size,
  note,
  actions,
}: {
  student: StatusControlStudent;
  size: StatusTriggerSize;
  note?: ReactNode;
  actions: StudentStatusActions;
}) {
  const t = useTranslations('students.status');
  const mobile = useIsMobile();
  const options = useStudentStatusOptionList(student.status);
  const [sheetOpen, setSheetOpen] = useState(false);
  const label = t(`${student.status}.label`);
  const triggerLabel = t('change', { status: label });
  const tone = STUDENT_STATUS_TONE[student.status];

  if (mobile) {
    return (
      <>
        <StatusTrigger
          tone={tone}
          label={label}
          size={size}
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          disabled={actions.pending}
          onClick={() => setSheetOpen(true)}
        />
        <StatusSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t('heading')}
          description={triggerLabel}
          closeLabel={t('close')}
          value={student.status}
          options={options}
          note={note}
          onSelect={(next) => {
            setSheetOpen(false);
            actions.choose(next);
          }}
        />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <StatusTrigger
          tone={tone}
          label={label}
          size={size}
          aria-label={triggerLabel}
          disabled={actions.pending}
        />
      </DropdownMenuTrigger>
      <StatusMenuContent
        heading={t('heading')}
        label={t('menuLabel')}
        value={student.status}
        options={options}
        note={note}
        onSelect={actions.choose}
      />
    </DropdownMenu>
  );
}
