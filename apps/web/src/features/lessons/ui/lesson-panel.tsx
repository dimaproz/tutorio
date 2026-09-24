'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CircleSlashIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { IconButton } from '@/components/shared/icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudentQuery } from '@/lib/api/students';
import { capitalizeFirst } from '@/lib/utils';
import {
  useLessonDetailQuery,
  usePrefetchLessonPanel,
  useScheduleQuery,
  useTransitionLessonMutation,
} from '../api';
import { cancellationActor, lessonHistory } from '../model/history';
import { isLessonRunning } from '../model/buckets';
import { panelActions, type FooterAction, type MenuAction } from '../model/panel-actions';
import { priceEditability } from '../model/payment';
import { AttendanceDialog } from './dialogs/attendance-dialog';
import { CancelDialog } from './dialogs/cancel-dialog';
import type { ChargeContext } from './dialogs/charge-context';
import { DeleteDialog } from './dialogs/delete-dialog';
import { MakeupDialog } from './dialogs/makeup-dialog';
import { StatusFixDialog } from './dialogs/status-fix-dialog';
import { LessonFooterActions, LessonTopBar } from './lesson-actions';
import { LessonEdit } from './lesson-edit';
import { useLessonDates, useMoney } from './lesson-format';
import { useErrorToast, useTeacherOptions } from './lesson-form-parts';
import { LessonAttendanceSummary, LessonMembers, useGroupMembers } from './lesson-group';
import { LessonHistory } from './lesson-history';
import { LessonPanelLayout, LessonPanelWindow } from './lesson-panel-window';
import { LessonPayment, useLessonPayment } from './lesson-payment';
import { LessonSummary, useScheduleLabel } from './lesson-summary';
import type { LessonPanelIntent } from './use-lesson-panel';

type DialogKind = 'cancel' | 'fixStatus' | 'makeup' | 'attendance' | 'delete';

export type LessonPanelLinks = {
  /** The student profile a lesson row links to. */
  studentHref?: (studentId: string) => string;
  /** The group page a group lesson links to. */
  groupHref?: (groupId: string) => string;
};

function PanelSkeleton({ mobile }: { mobile: boolean }) {
  const t = useTranslations('lessons.panel');
  const left = (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-4">
      <div className="flex justify-between">
        <Skeleton className="size-9.5 rounded-pill" />
        <div className="flex gap-2">
          <Skeleton className="size-9.5 rounded-pill" />
          <Skeleton className="size-9.5 rounded-pill" />
        </div>
      </div>
      <Skeleton className="h-3 w-30" />
      <Skeleton className="h-8.5 w-60" />
      <Skeleton className="h-4.5 w-50" />
      <Skeleton className="h-33 w-full rounded-tile" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
  const right = (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-42.5 w-full rounded-block" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-11 w-full rounded-control" />
      <Skeleton className="h-11 w-full rounded-control" />
      <Skeleton className="h-11 w-full rounded-control" />
    </div>
  );
  return (
    <>
      <DialogTitle className="sr-only">{t('loading')}</DialogTitle>
      <LessonPanelLayout mobile={mobile} topBar={null} main={left} aside={mobile ? null : right} />
    </>
  );
}

function PanelMessage({
  icon,
  title,
  text,
  action,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations('lessons.panel');
  return (
    <div className="flex flex-1 flex-col p-1">
      <IconButton icon={<XIcon />} label={t('close')} size={38} tone="paper" onClick={onClose} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 py-14 text-center">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-row bg-secondary text-muted-foreground [&_svg]:size-7"
        >
          {icon}
        </span>
        <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        <p className="max-w-95 text-sm text-muted-foreground">{text}</p>
        {action}
      </div>
    </div>
  );
}

/**
 * The lesson panel (S01): opens over any page for one lesson, `lessonId`
 * being the page's `?lesson=` parameter. It shows the lesson and runs every
 * action on it — edit in place, cancel, fix the status, makeup, attendance,
 * delete — and says so when the lesson no longer exists.
 */
export function LessonPanel({
  lessonId,
  onClose,
  onOpenLesson,
  links = {},
  linkTo,
  intent = null,
  nowMs,
}: {
  lessonId: string | null;
  /** A command to run once the lesson loads, e.g. from the next-lesson ticket. */
  intent?: LessonPanelIntent | null;
  onClose: () => void;
  /** Opens another lesson in the panel (the makeup or its original). */
  onOpenLesson: (lessonId: string) => void;
  links?: LessonPanelLinks;
  /** The absolute link to a lesson, for "copy link". */
  linkTo?: (lessonId: string) => string;
  /** Pins the clock (stories); the live clock otherwise. */
  nowMs?: number;
}) {
  const t = useTranslations('lessons.panel');
  const mobile = useIsMobile();
  const detail = useLessonDetailQuery(lessonId);
  usePrefetchLessonPanel(lessonId);
  const lesson = detail.data;
  const notFound = detail.error?.status === 404;

  return (
    <LessonPanelWindow
      open={lessonId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      description={t('description')}
      mobile={mobile}
      compact={notFound && !mobile}
    >
      {lesson && lesson.id === lessonId ? (
        <LessonPanelContent
          key={lesson.id}
          lesson={lesson}
          mobile={mobile}
          onClose={onClose}
          onOpenLesson={onOpenLesson}
          links={links}
          linkTo={linkTo}
          intent={intent}
          nowMs={nowMs}
        />
      ) : notFound ? (
        <PanelMessage
          icon={<CircleSlashIcon />}
          title={t('notFoundTitle')}
          text={t('notFoundText')}
          onClose={onClose}
          action={
            <Button type="button" variant="outline" onClick={onClose}>
              {t('close')}
            </Button>
          }
        />
      ) : detail.isError ? (
        <PanelMessage
          icon={<TriangleAlertIcon />}
          title={t('errorTitle')}
          text={t('errorText')}
          onClose={onClose}
          action={
            <Button type="button" variant="outline" onClick={() => void detail.refetch()}>
              {t('retry')}
            </Button>
          }
        />
      ) : (
        <PanelSkeleton mobile={mobile} />
      )}
    </LessonPanelWindow>
  );
}

function LessonPanelContent({
  lesson,
  mobile,
  onClose,
  onOpenLesson,
  links,
  linkTo,
  intent,
  nowMs,
}: {
  lesson: LessonDetailResponse;
  mobile: boolean;
  onClose: () => void;
  onOpenLesson: (lessonId: string) => void;
  links: LessonPanelLinks;
  linkTo?: (lessonId: string) => string;
  intent: LessonPanelIntent | null;
  nowMs?: number;
}) {
  const t = useTranslations('lessons');
  const tLevel = useTranslations('languageLevel');
  const liveNow = useNow({ updateInterval: 60_000 }).getTime();
  const now = nowMs ?? liveNow;
  const dates = useLessonDates();
  const money = useMoney();
  const showError = useErrorToast();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  // An intent opens its dialog only while the panel itself would offer it.
  const [dialog, setDialog] = useState<DialogKind | null>(() =>
    intent === 'markAttendance' && panelActions(lesson, now).primary === 'markAttendance'
      ? 'attendance'
      : null,
  );

  const group = lesson.groupId !== null;
  const student = useStudentQuery(lesson.student?.id ?? '', !group && Boolean(lesson.student));
  const schedule = useScheduleQuery(lesson.schedule?.id ?? null);
  const teachers = useTeacherOptions();
  const payment = useLessonPayment(lesson, now);
  const members = useGroupMembers(lesson);
  const transition = useTransitionLessonMutation(lesson.id);
  const scheduleLabel = useScheduleLabel(schedule.data);

  const events = useMemo(() => lessonHistory(lesson), [lesson]);
  const actions = panelActions(lesson, now);
  const running = isLessonRunning(lesson, now);

  const charge: ChargeContext = group
    ? { kind: 'group' }
    : payment.view.kind === 'package'
      ? {
          kind: 'package',
          name: payment.view.package.name ?? t('payment.label.package'),
          remaining: payment.pkg?.remainingCredits ?? payment.view.left,
          total: payment.view.package.lessonsTotal,
        }
      : { kind: 'money', amount: money(lesson.priceMinor, lesson.currency) };
  const who = lesson.student?.fullName ?? lesson.group?.name ?? '';
  const when = `${dates.time(lesson.startsAtUtc)}–${dates.endTime(lesson)}`;
  // The dialog subtitles open with the date: "Пт, 11 вересня · 17:00–18:00 · …".
  const longDay = capitalizeFirst(dates.longDay(lesson.startsAtUtc));
  const dialogProps = (kind: DialogKind) => ({
    lesson,
    open: dialog === kind,
    onOpenChange: (open: boolean) => setDialog(open ? kind : null),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        linkTo ? linkTo(lesson.id) : `${window.location.href.split('?')[0]}?lesson=${lesson.id}`,
      );
      toast.success(t('panel.linkCopied'));
    } catch {
      toast.error(t('panel.linkCopyFailed'));
    }
  };

  const runAction = (action: FooterAction | MenuAction) => {
    switch (action) {
      case 'edit':
      case 'move':
        setMode('edit');
        return;
      case 'cancel':
        setDialog('cancel');
        return;
      case 'fixStatus':
        setDialog('fixStatus');
        return;
      case 'makeup':
        setDialog('makeup');
        return;
      case 'markAttendance':
        setDialog('attendance');
        return;
      case 'delete':
        setDialog('delete');
        return;
      case 'copyLink':
        void copyLink();
        return;
      case 'noShow':
        transition
          .mutateAsync({ targetStatus: 'NO_SHOW' })
          .then(() => toast.success(t('actions.noShowDone')))
          .catch(showError);
        return;
    }
  };

  const dialogs = (
    <>
      <CancelDialog
        {...dialogProps('cancel')}
        subtitle={t('cancelDialog.subtitle', { date: longDay, time: when, name: who })}
        charge={charge}
        now={now}
      />
      <StatusFixDialog
        {...dialogProps('fixStatus')}
        subtitle={t('statusFix.subtitle', {
          date: longDay,
          status: t(`facts.linkStatus.${lesson.status}`),
          name: who,
        })}
        charge={charge}
        now={now}
      />
      {group ? (
        <AttendanceDialog {...dialogProps('attendance')} />
      ) : (
        <MakeupDialog {...dialogProps('makeup')} now={now} />
      )}
      <DeleteDialog {...dialogProps('delete')} onDeleted={onClose} />
    </>
  );

  if (mode === 'edit') {
    return (
      <LessonEdit
        lesson={lesson}
        schedule={schedule.data}
        priceMode={priceEditability(lesson, payment.billing)}
        mobile={mobile}
        onDone={() => setMode('view')}
      />
    );
  }

  const aside = group ? (
    <>
      <LessonAttendanceSummary
        lesson={lesson}
        rows={members.rows}
        history={events}
        now={now}
        onMark={() => setDialog('attendance')}
      />
      <LessonMembers rows={members.rows} loading={members.loading} mobile={mobile} />
      <LessonHistory lesson={lesson} events={events} teacherNames={teachers.names} fill={false} />
    </>
  ) : (
    <>
      <LessonPayment view={payment.view} lesson={lesson} pkg={payment.pkg} />
      <LessonHistory lesson={lesson} events={events} teacherNames={teachers.names} fill={!mobile} />
    </>
  );

  const studentLevel = student.data?.languageLevel ? tLevel(student.data.languageLevel) : null;
  const hasFooter = actions.primary !== null || actions.secondary !== null;

  return (
    <>
      <LessonPanelLayout
        mobile={mobile}
        topBar={
          <LessonTopBar
            mobile={mobile}
            menu={actions.menu}
            title={mobile ? t('panel.title') : undefined}
            onClose={onClose}
            onEdit={() => setMode('edit')}
            onAction={runAction}
          />
        }
        main={
          <LessonSummary
            lesson={lesson}
            running={running}
            cancelActor={cancellationActor(events)}
            studentHref={
              lesson.student && links.studentHref ? links.studentHref(lesson.student.id) : null
            }
            groupHref={lesson.groupId && links.groupHref ? links.groupHref(lesson.groupId) : null}
            studentLevel={studentLevel}
            studentAvatar={student.data?.avatarKey ?? null}
            teacherAvatar={teachers.avatars.get(lesson.teacherId) ?? null}
            groupMembers={members.rows.map((row) => row.student)}
            scheduleLabel={scheduleLabel}
            onOpenLesson={onOpenLesson}
          />
        }
        aside={aside}
        asideScrolls={group}
        footer={
          hasFooter ? <LessonFooterActions actions={actions} onAction={runAction} /> : undefined
        }
      />
      {dialogs}
    </>
  );
}
