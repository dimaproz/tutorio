'use client';

import type { ReactNode } from 'react';
import { ChevronRightIcon, CircleSlashIcon, CircleXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonDetailResponse, ScheduleResponse } from '@tutorio/validation';
import { DialogTitle } from '@/components/ui/dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { LessonCancellationCard } from '@/components/shared/lesson-cancellation-card';
import { TintBand } from '@/components/shared/tint-band';
import { AvatarStack, WhoCard } from '@/components/shared/who-picker';
import { capitalizeFirst } from '@/lib/utils';
import { useSlotsLabel } from './field-labels';
import { useDurationLabel, useLessonDates } from './lesson-format';
import { LessonRunningBadge, LessonStatusBadge } from './lesson-status-badge';

type Lesson = LessonDetailResponse;

type GroupMember = { id: string; fullName: string; avatarKey: string | null };

/**
 * The student (avatar, name, level) or the group (a stack of members, the
 * count and who is paused) as the band's white card, a link to the profile.
 */
function LessonEntityCard({
  lesson,
  studentHref,
  groupHref,
  studentLevel,
  studentAvatar,
  groupMembers,
  pausedMembers,
}: {
  lesson: Lesson;
  studentHref: string | null;
  groupHref: string | null;
  studentLevel: string | null;
  studentAvatar: string | null;
  groupMembers: GroupMember[];
  pausedMembers: number;
}) {
  const t = useTranslations('lessons.people');
  const chevron = <ChevronRightIcon />;
  if (lesson.group) {
    return (
      <WhoCard
        media={<AvatarStack people={groupMembers} max={4} size="sm" />}
        name={lesson.group.name}
        meta={
          pausedMembers > 0
            ? t('groupMetaPaused', { count: groupMembers.length, paused: pausedMembers })
            : t('groupMeta', { count: groupMembers.length })
        }
        href={groupHref ?? undefined}
        hrefLabel={t('openGroup', { name: lesson.group.name })}
        trail={chevron}
      />
    );
  }
  if (!lesson.student) return null;
  return (
    <WhoCard
      media={
        <EntityAvatar avatarKey={studentAvatar} fullName={lesson.student.fullName} size="lg" />
      }
      name={lesson.student.fullName}
      meta={studentLevel ? t('studentLevel', { level: studentLevel }) : t('student')}
      href={studentHref ?? undefined}
      hrefLabel={t('openStudent', { name: lesson.student.fullName })}
      trail={chevron}
    />
  );
}

/**
 * The band of the lesson window (layout A): the kind overline, the date, the
 * time and length with the status, the round actions, and the student or
 * group card. On phones the actions take a row of their own above the title.
 */
export function LessonBand({
  lesson,
  running,
  mobile,
  actionsStart,
  actionsEnd,
  studentHref,
  groupHref,
  studentLevel,
  studentAvatar,
  groupMembers,
  pausedMembers,
}: {
  lesson: Lesson;
  running: boolean;
  mobile: boolean;
  /** Phone: the back button. */
  actionsStart?: ReactNode;
  /** Edit, «⋯» and (desktop) close. */
  actionsEnd: ReactNode;
  studentHref: string | null;
  groupHref: string | null;
  studentLevel: string | null;
  studentAvatar: string | null;
  groupMembers: GroupMember[];
  pausedMembers: number;
}) {
  const t = useTranslations('lessons.panel');
  const dates = useLessonDates();
  const kind =
    lesson.kind === 'MAKEUP' ? 'makeup' : lesson.groupId ? 'group' : ('individual' as const);
  const heading = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs leading-4 font-semibold tracking-[0.04em] text-tint-indigo-meta uppercase">
        {t(`kind.${kind}`)}
      </span>
      <DialogTitle
        className={
          mobile
            ? 'text-[28px] leading-[34px] font-semibold tracking-[-0.03em]'
            : 'text-[32px] leading-[38px] font-semibold tracking-[-0.03em]'
        }
      >
        {capitalizeFirst(dates.longDay(lesson.startsAtUtc))}
      </DialogTitle>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[15px] text-tint-indigo-meta">
          {t('timeRange', {
            start: dates.time(lesson.startsAtUtc),
            end: dates.endTime(lesson),
            minutes: lesson.durationMin,
          })}
        </span>
        <LessonStatusBadge status={lesson.status} />
        {running ? <LessonRunningBadge /> : null}
      </div>
    </div>
  );

  return (
    <TintBand className={mobile ? 'gap-4 px-4 pt-4 pb-4.5' : undefined}>
      {mobile ? (
        <>
          <div className="flex items-center justify-between gap-2">
            {actionsStart}
            {actionsEnd}
          </div>
          {heading}
        </>
      ) : (
        <div className="flex items-start justify-between gap-4">
          {heading}
          {actionsEnd}
        </div>
      )}
      <LessonEntityCard
        lesson={lesson}
        studentHref={studentHref}
        groupHref={groupHref}
        studentLevel={studentLevel}
        studentAvatar={studentAvatar}
        groupMembers={groupMembers}
        pausedMembers={pausedMembers}
      />
    </TintBand>
  );
}

/** Who cancelled, why, when, and what it meant (S01 decision 5). */
export function LessonCancellation({ lesson, actor }: { lesson: Lesson; actor: string | null }) {
  const t = useTranslations('lessons.cancellation');
  const dates = useLessonDates();
  const duration = useDurationLabel();
  if (lesson.status !== 'CANCELLED_CHARGED' && lesson.status !== 'CANCELLED_UNCHARGED') {
    return null;
  }
  const charged = lesson.status === 'CANCELLED_CHARGED';
  const by = lesson.cancelledBy ?? 'STUDENT';
  const title =
    by === 'TEACHER'
      ? t('title.teacher')
      : by === 'GROUP'
        ? t('title.group')
        : charged
          ? t('title.studentLate')
          : t('title.studentOnTime');

  let when: string | undefined;
  if (lesson.cancelledAt) {
    const left = Date.parse(lesson.startsAtUtc) - Date.parse(lesson.cancelledAt);
    const base = {
      date: dates.shortDay(lesson.cancelledAt),
      time: dates.time(lesson.cancelledAt),
    };
    when = left > 0 ? t('whenBefore', { ...base, left: duration(left) }) : t('when', base);
    if (actor) when = t('byActor', { when, actor });
  }

  const deadline = lesson.cancellationDeadlineHours;
  const text =
    by === 'TEACHER' && !charged
      ? t('text.teacher')
      : by === 'GROUP' && !charged
        ? t('text.group')
        : by === 'STUDENT' && lesson.cancelledAt
          ? charged
            ? t('text.charged', { hours: deadline })
            : t('text.onTime', { hours: deadline })
          : charged
            ? t('text.chargedByHand')
            : t('text.free');

  return (
    <LessonCancellationCard
      tone={charged ? 'danger' : 'warning'}
      icon={charged ? <CircleXIcon /> : <CircleSlashIcon />}
      title={title}
      reason={lesson.cancelledReason ? t('reason', { reason: lesson.cancelledReason }) : undefined}
      when={when}
      text={text}
    />
  );
}

/**
 * The teacher as a paper block: avatar, name and «Викладач», or «Викладач ·
 * заміна для цього заняття» when the lesson is taught by someone other than
 * its direction's or group's teacher.
 */
export function LessonTeacherRow({
  lesson,
  avatar,
  substitute,
}: {
  lesson: Lesson;
  avatar: string | null;
  substitute: boolean;
}) {
  const t = useTranslations('lessons.people');
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-tile bg-background px-4 py-3">
      <EntityAvatar avatarKey={avatar} fullName={lesson.teacher.name} size="md" />
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[15px] leading-5 font-semibold">{lesson.teacher.name}</span>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {substitute ? t('teacherSubstitute') : t('teacher')}
        </span>
      </div>
    </div>
  );
}

/** Label/value pairs: topic, schedule, notes, and the makeup or original link. */
export function LessonFacts({
  lesson,
  scheduleLabel,
  onOpenLesson,
}: {
  lesson: Lesson;
  scheduleLabel: string | null;
  onOpenLesson: (lessonId: string) => void;
}) {
  const t = useTranslations('lessons.facts');
  const dates = useLessonDates();
  const link = (target: NonNullable<Lesson['makeup']>, detail: string) => {
    const date = capitalizeFirst(dates.longDay(target.startsAtUtc));
    return (
      <button
        type="button"
        onClick={() => onOpenLesson(target.id)}
        aria-label={t('openLesson', { date })}
        className="rounded-sm text-left font-semibold text-brand outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t('linkValue', { date, detail })}
      </button>
    );
  };
  const rows: { label: string; value: ReactNode }[] = [];
  if (lesson.original) {
    rows.push({
      label: t('original'),
      value: link(lesson.original, t(`linkStatus.${lesson.original.status}`)),
    });
  }
  if (lesson.topic) rows.push({ label: t('topic'), value: lesson.topic });
  if (scheduleLabel) rows.push({ label: t('schedule'), value: scheduleLabel });
  if (lesson.notes) rows.push({ label: t('notes'), value: lesson.notes });
  if (lesson.makeup) {
    rows.push({
      label: t('makeup'),
      value: link(lesson.makeup, dates.time(lesson.makeup.startsAtUtc)),
    });
  }
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[116px_1fr] gap-x-4 gap-y-2.5 md:grid-cols-[160px_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-[13px] leading-6 text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 text-sm leading-6 break-words whitespace-pre-line">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Пн і Пт о 17:00": the schedule's days when they share a time, else each day with its time. */
export function useScheduleLabel(schedule: ScheduleResponse | undefined): string | null {
  const label = useSlotsLabel();
  return label(schedule?.slots);
}
