'use client';

import type { ReactNode } from 'react';
import {
  CalendarClockIcon,
  CircleCheckIcon,
  ClipboardCheckIcon,
  LayersIcon,
  RotateCcwIcon,
  UserXIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { CoinMark, LessonTimeRow, RunningMark } from '@/components/shared/lesson-time-row';
import { DEFAULT_TEACHER_COLOR } from '@/lib/theme/user-colors';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import {
  timeRowBadge,
  timeRowMark,
  timeRowState,
  type TimeRowBadge,
  type TimeRowLesson,
  type TimeRowMark,
  type TimeRowPackage,
} from '../model/time-row';

const lessonName = (lesson: Pick<LessonResponse, 'student' | 'group'>) =>
  lesson.student?.fullName ?? lesson.group?.name ?? '';

/** The 36px media: the student's avatar, or the group tile. */
function RowMedia({ lesson }: { lesson: TimeRowLesson }) {
  return lesson.student ? (
    <EntityAvatar
      avatarKey={lesson.student.avatarKey}
      fullName={lesson.student.fullName}
      size="sm"
      tint="indigo"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5"
    >
      <LayersIcon />
    </span>
  );
}

function RowBadge({
  badge,
  onMarkAttendance,
}: {
  badge: TimeRowBadge;
  onMarkAttendance?: () => void;
}) {
  const t = useTranslations('lessons.timeRow.badge');
  switch (badge.kind) {
    case 'cancelled':
      return <Badge variant="neutral">{t('cancelled', { by: badge.by })}</Badge>;
    case 'cancelledCharged':
      return <Badge variant="warning">{t('cancelledCharged')}</Badge>;
    case 'noShow':
      return <Badge variant="danger">{t('noShow')}</Badge>;
    case 'markAttendance':
      return onMarkAttendance ? (
        <Button type="button" size="xs" onClick={onMarkAttendance}>
          {t('markAttendance')}
        </Button>
      ) : (
        <Badge variant="warning">{t('attendance')}</Badge>
      );
    case 'now':
      return <Badge variant="brand">{t('now', { minutes: badge.minutesLeft })}</Badge>;
    case 'unpaid':
      return <Badge variant="danger">{t('unpaid')}</Badge>;
    case 'held':
      return <Badge variant="success">{t('held')}</Badge>;
    case 'groupPaid':
      return (
        <Badge variant="neutral">{t('groupPaid', { paid: badge.paid, total: badge.total })}</Badge>
      );
    case 'package':
      return (
        <Badge variant={badge.low ? 'warning' : 'neutral'}>
          {t('package', { left: badge.left, total: badge.total })}
        </Badge>
      );
    case 'perLesson':
      return <Badge variant="neutral">{t('perLesson')}</Badge>;
  }
}

const MARK: Record<TimeRowMark, ReactNode> = {
  running: <RunningMark />,
  noShow: <UserXIcon aria-hidden="true" className="text-destructive" />,
  attendance: <ClipboardCheckIcon aria-hidden="true" className="text-status-hold" />,
  coin: <CoinMark className="size-5 text-[11px]" />,
  held: <CircleCheckIcon aria-hidden="true" className="text-success" />,
  makeup: <RotateCcwIcon aria-hidden="true" className="text-tint-indigo-foreground" />,
  moved: <CalendarClockIcon aria-hidden="true" className="text-muted-foreground" />,
};

/** The teacher's dot and name on the meta line (several teachers shown). */
function TeacherMeta({ teacher }: { teacher: LessonResponse['teacher'] }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: teacher.color ?? DEFAULT_TEACHER_COLOR }}
      />
      {teacher.name}
    </span>
  );
}

const Dot = () => <span aria-hidden="true">·</span>;

/**
 * A lesson as a `LessonTimeRow` (S11 section 3): its time and state, the
 * kind as the group tile or the makeup chip — never a colour —, the teacher
 * where several are shown, and on the right one badge and the row menu
 * (desktop) or one mark (`dense`). A click opens the S01 panel.
 */
export function TimedLessonRow({
  lesson,
  nowMs,
  dense = false,
  showTeacher = false,
  tint,
  pkg = null,
  lowCreditThreshold = 0,
  menu,
  onOpen,
  onMarkAttendance,
}: {
  lesson: TimeRowLesson;
  nowMs: number;
  dense?: boolean;
  /** Several teachers: the time takes the teacher's colour and the meta their name. */
  showTeacher?: boolean;
  /** The colour to tint with instead of the lesson's teacher's (a teacher's own profile). */
  tint?: string;
  /** The package the lesson's direction pays with now. */
  pkg?: TimeRowPackage | null;
  lowCreditThreshold?: number;
  /** The `⋯` (the S04 row menu), desktop only. */
  menu?: ReactNode;
  onOpen: (lessonId: string) => void;
  /** «Відмітити» on a finished group lesson nobody marked. */
  onMarkAttendance?: (lessonId: string) => void;
}) {
  const t = useTranslations('lessons.timeRow');
  const format = useLocalFormatter();
  const state = timeRowState(lesson, nowMs);
  const start = format.time(Date.parse(lesson.startsAtUtc));
  const end = format.time(Date.parse(lesson.startsAtUtc) + lesson.durationMin * 60_000);
  const name = lessonName(lesson);
  const group = lesson.groupId !== null;
  const makeup = lesson.kind === 'MAKEUP';
  const kind = group ? 'group' : makeup ? 'makeup' : 'individual';

  let meta: ReactNode;
  let trailing: ReactNode;
  if (dense) {
    meta = t('denseMeta', { minutes: lesson.durationMin, kind });
    const mark = timeRowMark(lesson, nowMs);
    trailing = mark ? MARK[mark] : null;
  } else {
    const parts: ReactNode[] = [];
    if (makeup) {
      parts.push(
        <Badge key="kind" variant="info" size="sm" className="shrink-0 font-semibold">
          {t('makeupChip')}
        </Badge>,
      );
    } else {
      parts.push(
        <span key="kind" className="shrink-0">
          {group
            ? lesson.groupMembers !== null
              ? t('groupOf', { count: lesson.groupMembers })
              : t('kind.group')
            : t('kind.individual')}
        </span>,
      );
    }
    if (showTeacher && !tint) parts.push(<TeacherMeta key="teacher" teacher={lesson.teacher} />);
    if (makeup && lesson.originalStartsAtUtc) {
      parts.push(
        <span key="for" className="shrink-0">
          {t('makeupFor', {
            date: format.dateTime(new Date(lesson.originalStartsAtUtc), {
              day: 'numeric',
              month: 'long',
            }),
          })}
        </span>,
      );
    }
    if (lesson.rescheduledCount > 0 && lesson.status === 'SCHEDULED') {
      parts.push(
        <span key="moved" className="flex shrink-0 items-center gap-1 [&_svg]:size-3.5">
          <CalendarClockIcon aria-hidden="true" />
          {t('moved')}
        </span>,
      );
    }
    if (lesson.topic) {
      parts.push(
        <span key="topic" className="truncate">
          {lesson.topic}
        </span>,
      );
    }
    meta = parts.flatMap((part, index) =>
      index === 0 ? [part] : [<Dot key={`d${index}`} />, part],
    );
    const badge = timeRowBadge(lesson, nowMs, pkg, lowCreditThreshold);
    trailing = (
      <>
        {badge ? (
          <RowBadge
            badge={badge}
            onMarkAttendance={onMarkAttendance ? () => onMarkAttendance(lesson.id) : undefined}
          />
        ) : null}
        {menu}
      </>
    );
  }

  return (
    <LessonTimeRow
      start={start}
      end={end}
      state={state}
      dense={dense}
      tint={showTeacher ? (tint ?? lesson.teacher.color ?? DEFAULT_TEACHER_COLOR) : null}
      media={<RowMedia lesson={lesson} />}
      name={name}
      meta={meta}
      trailing={trailing}
      onSelect={() => onOpen(lesson.id)}
      selectLabel={t('open', { name, time: `${start}–${end}` })}
    />
  );
}
