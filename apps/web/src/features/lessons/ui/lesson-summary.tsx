'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, CircleSlashIcon, CircleXIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { LessonDetailResponse, ScheduleResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { DialogTitle } from '@/components/ui/dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { LessonCancellationCard } from '@/components/shared/lesson-cancellation-card';
import { PersonItem } from '@/components/shared/person-item';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { capitalizeFirst } from '@/lib/utils';
import { LessonStatusBadge } from './lesson-status-badge';
import { useDurationLabel, useLessonDates } from './lesson-format';

type Lesson = LessonDetailResponse;

/** Overline, date, time and status: the head of the panel. */
function LessonHeading({ lesson, running }: { lesson: Lesson; running: boolean }) {
  const t = useTranslations('lessons.panel');
  const dates = useLessonDates();
  const kind =
    lesson.kind === 'MAKEUP' ? 'makeup' : lesson.groupId ? 'group' : ('individual' as const);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {t(`kind.${kind}`)}
      </span>
      <DialogTitle className="text-[34px] leading-10 font-semibold tracking-[-0.03em]">
        {capitalizeFirst(dates.longDay(lesson.startsAtUtc))}
      </DialogTitle>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[15px] text-muted-foreground">
          {t('timeRange', {
            start: dates.time(lesson.startsAtUtc),
            end: dates.endTime(lesson),
            minutes: lesson.durationMin,
          })}
        </span>
        <LessonStatusBadge status={lesson.status} />
        {running ? (
          <Badge variant="brand" dot>
            {t('runningNow')}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

/** Who cancelled, why, when, and what it meant (S01 decision 5). */
function Cancellation({ lesson, actor }: { lesson: Lesson; actor: string | null }) {
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

/** The student (or the group with its members) and the teacher, in one paper block. */
function People({
  lesson,
  studentHref,
  groupHref,
  studentLevel,
  studentAvatar,
  teacherAvatar,
  groupMembers,
  scheduleLabel,
}: {
  lesson: Lesson;
  studentHref: string | null;
  groupHref: string | null;
  studentLevel: string | null;
  studentAvatar: string | null;
  teacherAvatar: string | null;
  groupMembers: { id: string; fullName: string; avatarKey: string | null }[];
  scheduleLabel: string | null;
}) {
  const t = useTranslations('lessons.people');
  const chevron = <ChevronRightIcon className="size-4.5" />;
  return (
    <div className="flex shrink-0 flex-col rounded-tile bg-secondary px-4 py-2">
      {lesson.group ? (
        <div className="relative flex items-center gap-3 py-2">
          <div className="flex min-w-0 grow flex-col">
            <span className="truncate text-[15px] leading-5 font-semibold">
              {groupHref ? (
                <Link
                  prefetch={false}
                  href={groupHref}
                  aria-label={t('openGroup', { name: lesson.group.name })}
                  className="outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:after:outline-2 focus-visible:after:outline-ring"
                >
                  {lesson.group.name}
                </Link>
              ) : (
                lesson.group.name
              )}
            </span>
            <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
              {scheduleLabel ? t('groupSchedule', { schedule: scheduleLabel }) : t('group')}
            </span>
          </div>
          <div aria-hidden="true" className="flex shrink-0 *:not-first:-ml-2">
            {groupMembers.slice(0, 6).map((member) => (
              <EntityAvatar
                key={member.id}
                avatarKey={member.avatarKey}
                fullName={member.fullName}
                size="sm"
                className="ring-2 ring-secondary"
              />
            ))}
          </div>
        </div>
      ) : lesson.student ? (
        <PersonItem
          className="py-2"
          media={
            <EntityAvatar avatarKey={studentAvatar} fullName={lesson.student.fullName} size="lg" />
          }
          name={lesson.student.fullName}
          subtitle={studentLevel ? t('studentLevel', { level: studentLevel }) : t('student')}
          href={studentHref ?? undefined}
          hrefLabel={t('openStudent', { name: lesson.student.fullName })}
          trail={studentHref ? chevron : undefined}
        />
      ) : null}
      <div className="border-t border-border" />
      <PersonItem
        className="py-2"
        media={<EntityAvatar avatarKey={teacherAvatar} fullName={lesson.teacher.name} size="lg" />}
        name={lesson.teacher.name}
        subtitle={t('teacher')}
      />
    </div>
  );
}

/** Label/value pairs: topic, schedule, notes, and the makeup or original link. */
function Facts({
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
    <dl className="grid grid-cols-[116px_1fr] gap-x-4 gap-y-2.5">
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
  const t = useTranslations('lessons.facts');
  const format = useFormatter();
  const days = useWeekdayLabels();
  if (!schedule || schedule.slots.length === 0) return null;
  // Monday first, Sunday last.
  const slots = [...schedule.slots].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const times = new Set(slots.map((slot) => slot.localTime));
  if (times.size === 1) {
    const names = format.list(
      slots.map((slot) => capitalizeFirst(days[slot.weekday] ?? '')),
      { type: 'conjunction' },
    );
    return t('slot', { days: names, time: slots[0]!.localTime });
  }
  return slots
    .map((slot) => `${capitalizeFirst(days[slot.weekday] ?? '')} ${slot.localTime}`)
    .join(' · ');
}

/**
 * The left column of the panel (and the top of the phone sheet): heading,
 * cancellation card, people and facts.
 */
export function LessonSummary({
  lesson,
  running,
  cancelActor,
  studentHref,
  groupHref,
  studentLevel,
  studentAvatar,
  teacherAvatar,
  groupMembers,
  scheduleLabel,
  onOpenLesson,
}: {
  lesson: Lesson;
  running: boolean;
  cancelActor: string | null;
  studentHref: string | null;
  groupHref: string | null;
  studentLevel: string | null;
  studentAvatar: string | null;
  teacherAvatar: string | null;
  groupMembers: { id: string; fullName: string; avatarKey: string | null }[];
  scheduleLabel: string | null;
  onOpenLesson: (lessonId: string) => void;
}) {
  return (
    <>
      <LessonHeading lesson={lesson} running={running} />
      <Cancellation lesson={lesson} actor={cancelActor} />
      <People
        lesson={lesson}
        studentHref={studentHref}
        groupHref={groupHref}
        studentLevel={studentLevel}
        studentAvatar={studentAvatar}
        teacherAvatar={teacherAvatar}
        groupMembers={groupMembers}
        scheduleLabel={scheduleLabel}
      />
      <Facts lesson={lesson} scheduleLabel={scheduleLabel} onOpenLesson={onOpenLesson} />
    </>
  );
}
