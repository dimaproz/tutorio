'use client';

import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { CircleCheckIcon, RotateCcwIcon, UserXIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { CoinMark } from '@/components/shared/lesson-time-row';
import { DEFAULT_TEACHER_COLOR } from '@/lib/theme/user-colors';
import { cn } from '@/lib/utils';
import {
  LESSON_TYPE_CLASS,
  lessonEndMs,
  lessonMarks,
  lessonTime,
  lessonTitle,
  lessonType,
  type CalendarLesson,
  type LessonTime,
} from '../model/lessons';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';

export type CalendarEventVariant = 'block' | 'wide' | 'chip';
export type CalendarEventState = 'idle' | 'ghost' | 'dragging' | 'conflict';

/** The fill says the time (decision 4); the colour comes from `--lesson`. */
// S11: a past tile is lighter and has no outline; a cancelled one is a quiet
// card with a hairline, muted text and a strike on the time only.
const FILL: Record<LessonTime, string> = {
  upcoming: 'border-[1.5px] border-[color-mix(in_oklab,var(--lesson)_55%,transparent)] bg-card',
  past: 'border-[1.5px] border-transparent bg-[color-mix(in_oklab,var(--lesson)_10%,var(--card))]',
  running: 'border-2 border-(--lesson) bg-[color-mix(in_oklab,var(--lesson)_14%,var(--card))]',
  cancelled: 'border border-border bg-card text-muted-foreground',
};

// Times read in the sans font with tabular figures (S11 decision 10). With
// several teachers the time takes the teacher's colour (`--time-tint`, user
// data) instead of the lesson's.
const TIME_TEXT =
  'tabular-nums text-[color-mix(in_oklab,var(--time-tint,var(--lesson))_60%,var(--foreground))]';

/** "10:00–11:00", or the start alone. */
export function useEventTimes() {
  const format = useLocalFormatter();
  const time = (ms: number) => format.time(ms);
  return {
    start: (lesson: CalendarLesson) => time(Date.parse(lesson.startsAtUtc)),
    range: (lesson: CalendarLesson) =>
      `${time(Date.parse(lesson.startsAtUtc))}–${time(lessonEndMs(lesson))}`,
  };
}

/** The card's accessible name: time, name, type and status. */
export function useEventLabel() {
  const t = useTranslations('calendar.event');
  const times = useEventTimes();
  return (lesson: CalendarLesson, nowMs: number) => {
    const time = lessonTime(lesson, nowMs);
    const marks = lessonMarks(lesson);
    const status =
      time === 'cancelled'
        ? 'cancelled'
        : marks.noShow
          ? 'noShow'
          : marks.held
            ? 'held'
            : time === 'running'
              ? 'running'
              : time === 'past'
                ? 'past'
                : 'upcoming';
    return t('label', {
      time: times.range(lesson),
      title: lessonTitle(lesson),
      type: lessonType(lesson),
      status,
      unpaid: marks.unpaid ? 'yes' : 'no',
      teacher: lesson.teacher.name,
    });
  };
}

/** The round warning «₴»: a lesson not paid yet. */
export const UnpaidMark = CoinMark;

/** The teacher's 7px dot beside the time, where several teachers are shown (S11). */
function TeacherDot() {
  return <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-(--time-tint)" />;
}

function Marks({ lesson }: { lesson: CalendarLesson }) {
  const marks = lessonMarks(lesson);
  if (!marks.held && !marks.noShow && !marks.unpaid) return null;
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-1 [&_svg]:size-3.5">
      {marks.held ? <CircleCheckIcon className="text-(--lesson)" /> : null}
      {marks.noShow ? <UserXIcon className="text-destructive" /> : null}
      {marks.unpaid ? <UnpaidMark /> : null}
    </span>
  );
}

function Title({ lesson, className }: { lesson: CalendarLesson; className?: string }) {
  const marks = lessonMarks(lesson);
  return (
    <span className={cn('flex min-w-0 items-center gap-1 font-semibold', className)}>
      {marks.makeup ? <RotateCcwIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
      {marks.group ? <UsersIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
      <span className="truncate">{lessonTitle(lesson)}</span>
    </span>
  );
}

function RunningDot() {
  return (
    <span aria-hidden="true" className="relative flex size-2 shrink-0">
      <span className="absolute inset-0 animate-ping rounded-full bg-(--lesson) opacity-60" />
      <span className="relative size-2 rounded-full bg-(--lesson)" />
    </span>
  );
}

/** The day view's status badge: «Відбулося», «Йде зараз», «Відпрацювання». */
function StatusBadge({ lesson, time }: { lesson: CalendarLesson; time: LessonTime }) {
  const t = useTranslations('calendar.badge');
  const marks = lessonMarks(lesson);
  if (time === 'cancelled') return <Badge variant="secondary">{t('cancelled')}</Badge>;
  if (time === 'running')
    return (
      <Badge variant="info" dot>
        {t('running')}
      </Badge>
    );
  if (marks.makeup) return <Badge variant="warning">{t('makeup')}</Badge>;
  if (marks.noShow) return <Badge variant="destructive">{t('noShow')}</Badge>;
  if (marks.held) return <Badge variant="success">{t('held')}</Badge>;
  return null;
}

/**
 * A lesson on the calendar (S03 decisions 4–6). `block` sits on the week
 * grid: time and marks, the name, the topic from 90 minutes; `compact` is one
 * line for 45 minutes or less, and a lane shows the start only. `wide` is
 * the day view's card with the avatar and a status badge; `chip` is the month
 * cell's line; `row` is the phone's week and month list. `ghost` marks the
 * old slot during a drag, `dragging` and `conflict` the lifted card.
 */
export function CalendarEvent({
  lesson,
  nowMs,
  variant = 'block',
  compact = false,
  startOnly = false,
  withTopic = false,
  showTeacher = false,
  state = 'idle',
  stacked = false,
  className,
  style,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  lesson: CalendarLesson;
  nowMs: number;
  variant?: CalendarEventVariant;
  compact?: boolean;
  /** In a lane, the time row shows the start only. */
  startOnly?: boolean;
  /** The topic line (lessons of 90 minutes or more). */
  withTopic?: boolean;
  /** Several teachers are shown: the time and a dot in the teacher's colour. */
  showTeacher?: boolean;
  state?: CalendarEventState;
  /** A `wide` card with the time under the name (the phone's day). */
  stacked?: boolean;
}) {
  const times = useEventTimes();
  const label = useEventLabel();
  const time = lessonTime(lesson, nowMs);
  const type = lessonType(lesson);
  const cancelled = time === 'cancelled';
  const lifted = state === 'dragging' || state === 'conflict';

  const shell = cn(
    'group/event relative flex w-full min-w-0 overflow-hidden text-left text-foreground outline-none select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
    LESSON_TYPE_CLASS[type],
    FILL[time],
    // The old slot during a drag: its outline only, the card has moved.
    state === 'ghost' &&
      'border-dashed border-(--lesson) bg-transparent bg-none opacity-50 [&>*]:invisible',
    lifted && '-rotate-[1.5deg] shadow-dialog ring-2 ring-brand',
    state === 'conflict' &&
      'border-destructive bg-tint-danger text-tint-danger-foreground ring-destructive [--lesson:var(--destructive)]',
    className,
  );
  const bar = (
    <span
      aria-hidden="true"
      className={cn(
        'absolute inset-y-0 left-0 w-[3px]',
        cancelled ? 'bg-status-archived' : 'bg-(--lesson)',
      )}
    />
  );
  const tinted = showTeacher && !cancelled;
  const tintStyle = {
    ...style,
    ...(tinted
      ? ({ '--time-tint': lesson.teacher.color ?? DEFAULT_TEACHER_COLOR } as CSSProperties)
      : {}),
  };
  const strike = cancelled && 'line-through decoration-1';
  // A running tile already leads with its live dot.
  const dot = tinted && time !== 'running' ? <TeacherDot /> : null;
  const timeText = (text: ReactNode) => (
    <span className="flex min-w-0 items-center gap-1">
      {dot}
      <span className={cn(TIME_TEXT, strike)}>{text}</span>
    </span>
  );

  if (variant === 'chip') {
    return (
      <button
        type="button"
        aria-label={label(lesson, nowMs)}
        className={cn(
          shell,
          'h-5 items-center gap-1.5 rounded-md pr-1.5 pl-2 text-[11px] leading-4',
        )}
        style={tintStyle}
        {...props}
      >
        {bar}
        {timeText(times.start(lesson))}
        <span className="truncate font-semibold">{lessonTitle(lesson)}</span>
      </button>
    );
  }

  if (variant === 'wide') {
    return (
      <button
        type="button"
        aria-label={label(lesson, nowMs)}
        className={cn(shell, 'h-full items-start gap-3 rounded-tile py-3 pr-4 pl-5')}
        style={tintStyle}
        {...props}
      >
        {bar}
        {lesson.student ? (
          <EntityAvatar
            avatarKey={lesson.student.avatarKey}
            fullName={lesson.student.fullName}
            tint="indigo"
            className="size-10"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-(--lesson) [&_svg]:size-4.5"
          >
            <UsersIcon />
          </span>
        )}
        <span className="flex min-w-0 grow flex-col gap-1">
          <span
            className={cn('flex min-w-0', stacked ? 'flex-col gap-0.5' : 'items-baseline gap-2.5')}
          >
            <span className="truncate text-[15px] leading-5 font-semibold">
              {lessonTitle(lesson)}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs">
              {dot}
              <span className={cn(TIME_TEXT, strike)}>{times.range(lesson)}</span>
            </span>
          </span>
          {lesson.topic ? (
            <span className="truncate text-sm leading-5 text-muted-foreground">{lesson.topic}</span>
          ) : null}
        </span>
        {stacked ? (
          // The phone card keeps to marks, so the name keeps its room.
          <span aria-hidden="true" className="flex shrink-0 items-center gap-2 [&_svg]:size-4.5">
            {time === 'running' ? <RunningDot /> : null}
            {lessonMarks(lesson).held ? <CircleCheckIcon className="text-(--lesson)" /> : null}
            {lessonMarks(lesson).noShow ? <UserXIcon className="text-destructive" /> : null}
            {lessonMarks(lesson).makeup ? <RotateCcwIcon className="text-(--lesson)" /> : null}
            {lessonMarks(lesson).unpaid ? <UnpaidMark className="size-5 text-[11px]" /> : null}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-2">
            <StatusBadge lesson={lesson} time={time} />
            {lessonMarks(lesson).unpaid ? <UnpaidMark className="size-5 text-[11px]" /> : null}
          </span>
        )}
      </button>
    );
  }

  // block
  return (
    <button
      type="button"
      aria-label={label(lesson, nowMs)}
      className={cn(
        shell,
        'h-full rounded-[10px] py-[5px] pr-[7px] pl-[10px] text-xs leading-4',
        compact ? 'flex-row items-center gap-1.5' : 'flex-col gap-0.5',
      )}
      style={tintStyle}
      {...props}
    >
      {bar}
      {compact ? (
        <>
          {time === 'running' ? <RunningDot /> : null}
          <span className="shrink-0 text-[11px]">{timeText(times.start(lesson))}</span>
          <Title lesson={lesson} className="grow" />
          <Marks lesson={lesson} />
        </>
      ) : (
        <>
          <span className="flex min-w-0 items-center justify-between gap-1">
            <span className="flex min-w-0 items-center gap-1 text-[11px]">
              {time === 'running' ? <RunningDot /> : null}
              {timeText(startOnly ? times.start(lesson) : times.range(lesson))}
            </span>
            <Marks lesson={lesson} />
          </span>
          <Title lesson={lesson} />
          {withTopic && lesson.topic ? (
            <span className="truncate text-[11px] text-muted-foreground">{lesson.topic}</span>
          ) : null}
        </>
      )}
    </button>
  );
}
