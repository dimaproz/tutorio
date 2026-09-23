'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArchiveIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
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
import { useLessonsQuery, useTransitionLessonMutation } from '@/lib/api/scheduling';
import {
  useArchiveStudentMutation,
  useRestoreStudentMutation,
  useUpdateStudentMutation,
} from '@/lib/api/students';
import { studentStatusTransition } from '@/features/students/model/lifecycle';
import { StudentHoldDialog } from './student-hold-dialog';

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
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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

/**
 * Every student status change in one place: the hold dialog with its optional
 * lesson cancellation, the archive confirmation, and the immediate resume and
 * restore. Status changes save on their own and never touch an open form.
 */
export function useStudentStatusActions(student: StatusControlStudent) {
  const t = useTranslations('students');
  const tErrors = useTranslations('errors');
  const [dialog, setDialog] = useState<'hold' | 'archive' | null>(null);
  const clock = useNow();
  // The cancellation window opens when the tutor asks for the hold, not when
  // the page mounted: a lesson taught in between is history, not a plan.
  const [holdFrom, setHoldFrom] = useState(() => clock.getTime());
  const update = useUpdateStudentMutation(student.id);
  const archive = useArchiveStudentMutation();
  const restore = useRestoreStudentMutation();
  const transition = useTransitionLessonMutation();
  const [cancelling, setCancelling] = useState(false);

  // Only individual lessons are cancelled: a group lesson belongs to the whole
  // group and keeps running for everyone else.
  const scheduled = useLessonsQuery(
    {
      from: new Date(holdFrom).toISOString(),
      to: new Date(holdFrom + YEAR_MS).toISOString(),
      studentId: student.id,
      status: 'SCHEDULED',
    },
    dialog === 'hold',
  );
  const individual = scheduled.isPlaceholderData
    ? undefined
    : scheduled.data?.items.filter((lesson) => lesson.groupId === null);
  const firstName = student.fullName.split(/\s+/)[0] || student.fullName;
  const fail = (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));

  const choose = (next: StudentStatusDto) => {
    const change = studentStatusTransition(student.status, next);
    if (change.kind === 'hold') {
      setHoldFrom(Date.now());
      setDialog('hold');
    }
    if (change.kind === 'archive') setDialog('archive');
    if (change.kind === 'reactivate') {
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

  const confirmHold = async ({ cancelLessons }: { cancelLessons: boolean }) => {
    try {
      // Re-checked at confirmation: the dialog may have stayed open past a start.
      const confirmedAt = Date.now();
      const upcoming = individual?.filter(
        (lesson) => new Date(lesson.startsAtUtc).getTime() >= confirmedAt,
      );
      if (cancelLessons && upcoming?.length) {
        setCancelling(true);
        // Sequential on purpose: the server validates each transition against
        // the package ledger, and a partial failure must stop the batch.
        for (const lesson of upcoming) {
          await transition.mutateAsync({
            lessonId: lesson.id,
            dto: { targetStatus: 'CANCELLED_UNCHARGED', cancelledBy: 'TEACHER' },
          });
        }
      }
      await update.mutateAsync({ status: 'ON_HOLD' });
      setDialog(null);
      toast.success(t('toasts.onHoldName', { name: firstName }));
    } catch (error) {
      fail(error);
    } finally {
      setCancelling(false);
    }
  };

  const confirmArchive = () =>
    archive.mutate(student.id, {
      onSuccess: () => {
        setDialog(null);
        toast.success(t('toasts.archived'));
      },
      onError: fail,
    });

  const dialogs = (
    <>
      <StudentHoldDialog
        open={dialog === 'hold'}
        onOpenChange={(open) => setDialog(open ? 'hold' : null)}
        fullName={student.fullName}
        // A new hold window is a new query key, and the previous opening's list
        // is served as placeholder until it answers: that list is not a count.
        scheduledLessons={
          scheduled.isSuccess && !scheduled.isPlaceholderData
            ? (individual?.length ?? 0)
            : scheduled.isError
              ? 0
              : undefined
        }
        pending={cancelling || update.isPending}
        onConfirm={(options) => void confirmHold(options)}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        onOpenChange={(open) => setDialog(open ? 'archive' : null)}
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
    pending: update.isPending || archive.isPending || restore.isPending || cancelling,
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
