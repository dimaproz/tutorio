'use client';

import type { ReactNode } from 'react';
import { ArrowRightIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScheduleConflict, ScheduleSlotDto } from '@tutorio/validation';
import { DateTile } from '@/components/shared/date-tile';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { cn } from '@/lib/utils';
import { conflictPairs, type SlotChange } from '../../model/schedule';

const mondayFirst = (weekday: number) => (weekday + 6) % 7;

/** «ВТ» for a weekday index. */
export function useDayCode() {
  const days = useWeekdayLabels();
  return (weekday: number) => (days[weekday] ?? '').toLocaleUpperCase();
}

/** «по 60 хв», «по 1,5 год». */
export function useLengthLabel() {
  const t = useTranslations('schedules.labels');
  // Up to an hour in minutes, longer in hours when it is whole or half («1,5»).
  return (minutes: number) =>
    minutes > 60 && minutes % 30 === 0
      ? t('hours', { hours: minutes / 60 })
      : t('minutes', { minutes });
}

/** One slot as a chip: «ВТ 18:00», filled, struck through or on paper. */
export function SlotChip({
  weekday,
  time,
  tone = 'muted',
  className,
}: {
  weekday: number;
  time: string;
  /** `muted` in lists, `paper` on a tint, `ink` a new time, `removed` struck through. */
  tone?: 'muted' | 'paper' | 'ink' | 'removed';
  className?: string;
}) {
  const code = useDayCode();
  return (
    <span
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-item px-2.5 text-sm leading-5 tabular-nums',
        tone === 'muted' && 'bg-secondary text-foreground',
        tone === 'paper' && 'bg-card text-foreground',
        tone === 'ink' && 'bg-primary font-semibold text-primary-foreground',
        tone === 'removed' && 'bg-card text-muted-foreground line-through',
        className,
      )}
    >
      <span className="font-semibold">{code(weekday)}</span>
      {time}
    </span>
  );
}

/** A schedule's slots as chips, Monday first. */
export function SlotChips({
  slots,
  tone,
  className,
}: {
  slots: readonly ScheduleSlotDto[];
  tone?: 'muted' | 'paper';
  className?: string;
}) {
  return (
    <span className={cn('flex flex-wrap gap-2', className)}>
      {[...slots]
        .sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday))
        .map((slot) => (
          <SlotChip key={slot.weekday} weekday={slot.weekday} time={slot.localTime} tone={tone} />
        ))}
    </span>
  );
}

/** «ЗАРАЗ ВТ 17:00 ПТ 18:30 по 60 хв»: the rule in force, in a grey row. */
export function CurrentRule({
  slots,
  durationMin,
}: {
  slots: readonly ScheduleSlotDto[];
  durationMin: number;
}) {
  const t = useTranslations('schedules.change');
  const length = useLengthLabel();
  const code = useDayCode();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-row bg-secondary px-5 py-4 text-[15px]">
      <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {t('now')}
      </span>
      {[...slots]
        .sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday))
        .map((slot) => (
          <span key={slot.weekday} className="tabular-nums">
            <span className="font-semibold">{code(slot.weekday)}</span> {slot.localTime}
          </span>
        ))}
      <span className="text-muted-foreground">{length(durationMin)}</span>
    </div>
  );
}

/** «Зараз» → «З 1 жовтня»: the changed slot filled, a removed one struck through. */
export function RuleChange({
  changes,
  durationBefore,
  durationAfter,
  afterLabel,
  stacked = false,
}: {
  changes: readonly SlotChange[];
  durationBefore: number;
  durationAfter: number;
  afterLabel: string;
  /** Phones: each column's chips under each other. */
  stacked?: boolean;
}) {
  const t = useTranslations('schedules.change');
  const length = useLengthLabel();
  const column = (label: string, chips: ReactNode, minutes: number) => (
    <div className="flex min-w-0 flex-col gap-3">
      <span className="text-xs font-semibold tracking-[0.06em] text-tint-foreground uppercase">
        {label}
      </span>
      <div className={cn('flex gap-2', stacked ? 'flex-col items-start' : 'flex-wrap')}>
        {chips}
      </div>
      <span className="text-sm text-tint-foreground">{length(minutes)}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 rounded-card bg-tint-info px-5 py-5">
      {column(
        t('now'),
        changes
          .filter((change) => change.before)
          .map((change) => (
            <SlotChip
              key={change.weekday}
              weekday={change.weekday}
              time={change.before!}
              tone="paper"
            />
          )),
        durationBefore,
      )}
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-pill bg-card text-brand [&_svg]:size-4"
      >
        <ArrowRightIcon />
      </span>
      {column(
        afterLabel,
        changes.map((change) =>
          change.after ? (
            <SlotChip
              key={change.weekday}
              weekday={change.weekday}
              time={change.after}
              tone={change.after === change.before ? 'paper' : 'ink'}
            />
          ) : (
            <SlotChip
              key={change.weekday}
              weekday={change.weekday}
              time={change.before!}
              tone="removed"
            />
          ),
        ),
        durationAfter,
      )}
    </div>
  );
}

const TILE_TONE = {
  info: 'bg-tint-info text-tint-foreground',
  danger: 'bg-tint-danger text-tint-danger-foreground',
  neutral: 'bg-secondary text-foreground',
} as const;

/** The four counts of a change: moved, removed, created, untouched. */
export function CountTiles({
  items,
  className,
}: {
  items: { id: string; value: number; label: string; tone: keyof typeof TILE_TONE }[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn('flex flex-col gap-1 rounded-row px-4 py-3.5', TILE_TONE[item.tone])}
        >
          <dt className="order-2 text-sm leading-5 opacity-80">{item.label}</dt>
          <dd className="order-1 text-[28px] leading-8 font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The date tile's parts: «ЧТ» over «1». */
export function useTileParts() {
  const format = useLocalFormatter();
  return (iso: string) => {
    const date = new Date(iso);
    return {
      top: format.dateTime(date, { weekday: 'short' }),
      day: format.dateTime(date, { day: 'numeric' }),
    };
  };
}

/**
 * The lessons of a check step as cards (S05 decision 6): the date tile, the
 * time and the month in the nominative («вересень»); a date that overlaps
 * another lesson is a warning card with «накладка».
 */
export function DateCards({
  dates,
  conflicting,
}: {
  dates: readonly string[];
  conflicting: ReadonlySet<string>;
}) {
  const t = useTranslations('schedules.check');
  const format = useLocalFormatter();
  const tile = useTileParts();
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {dates.map((iso) => {
        const conflict = conflicting.has(iso);
        return (
          <li
            key={iso}
            className={cn(
              'flex items-center gap-3 rounded-row border p-2.5',
              conflict ? 'border-transparent bg-tint-warning' : 'border-border bg-card',
            )}
          >
            <DateTile {...tile(iso)} size={52} className={conflict ? 'bg-card' : undefined} />
            <span className="flex min-w-0 flex-col">
              <span className="text-[17px] leading-6 font-semibold tabular-nums">
                {format.time(Date.parse(iso))}
              </span>
              {conflict ? (
                <span className="flex items-center gap-1 text-[13px] font-semibold text-tint-warning-foreground [&_svg]:size-3.5">
                  <TriangleAlertIcon aria-hidden="true" />
                  {t('overlap')}
                </span>
              ) : (
                <span className="truncate text-[13px] text-muted-foreground">
                  {format.dateTime(new Date(iso), { month: 'long' })}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What the new lessons overlap (S05 decision 4): the count, who is already
 * busy then, and one pair per date — the new lesson (tint) ⚠ the booked one.
 */
export function ConflictPairs({
  conflicts,
  durationMin,
  title,
  newLabel,
  mobile,
}: {
  conflicts: readonly ScheduleConflict[];
  durationMin: number;
  /** The new lesson's name, e.g. the student. */
  title: string;
  /** «Нове» or «Після зміни». */
  newLabel: string;
  mobile: boolean;
}) {
  const t = useTranslations('schedules.conflicts');
  const format = useLocalFormatter();
  const tile = useTileParts();
  const pairs = conflictPairs(conflicts);
  const range = (iso: string, minutes: number) =>
    `${format.time(Date.parse(iso))}–${format.time(Date.parse(iso) + minutes * 60_000)}`;
  const nameOf = (conflict: ScheduleConflict) =>
    conflict.group?.name ?? conflict.student?.fullName ?? '';
  const first = conflicts[0];
  const explain = first
    ? pairs.length === 1
      ? t('explainOne', {
          date: format.dateTime(new Date(first.candidateStartsAtUtc), {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
          }),
          time: format.time(Date.parse(first.startsAtUtc)),
          teacher: first.teacher.name,
          kind: first.group ? 'group' : 'lesson',
          name: nameOf(first),
        })
      : t('explainMany', {
          teacher: first.teacher.name,
          kind: first.group ? 'group' : 'lesson',
          name: nameOf(first),
          time: range(first.startsAtUtc, first.durationMin),
        })
    : '';

  return (
    <section className="flex flex-col gap-3 rounded-card bg-tint-warning px-5 py-5 text-tint-foreground">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-start gap-2 text-[17px] leading-6 font-semibold text-tint-warning-foreground [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0">
          <TriangleAlertIcon aria-hidden="true" />
          {t('title', { count: pairs.length })}
        </h3>
        <p className="text-[15px] leading-6">{explain}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {pairs.map(({ candidateStartsAtUtc, hits }) => (
          <li
            key={candidateStartsAtUtc}
            className="flex items-center gap-3 rounded-row bg-card p-3 text-foreground"
          >
            <DateTile {...tile(candidateStartsAtUtc)} size={52} />
            {mobile ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[17px] leading-6 font-semibold">{title}</span>
                <span className="text-sm text-muted-foreground">
                  {`${newLabel.toLocaleLowerCase()} · ${range(candidateStartsAtUtc, durationMin)}`}
                </span>
                {hits.map((hit) => (
                  <span
                    key={hit.lessonId}
                    className="flex items-center gap-1.5 text-sm text-tint-warning-foreground [&_svg]:size-3.5"
                  >
                    <TriangleAlertIcon aria-hidden="true" />
                    {`${nameOf(hit)} · ${range(hit.startsAtUtc, hit.durationMin)}`}
                  </span>
                ))}
              </div>
            ) : (
              <div className="grid min-w-0 grow grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <PairCard
                  label={newLabel}
                  name={title}
                  time={range(candidateStartsAtUtc, durationMin)}
                  tint
                />
                <span
                  aria-label={t('overlapsWith')}
                  className="flex size-8 items-center justify-center rounded-pill bg-tint-warning text-tint-warning-foreground [&_svg]:size-4"
                >
                  <TriangleAlertIcon aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  {hits.map((hit) => (
                    <PairCard
                      key={hit.lessonId}
                      label={hit.kind === 'MAKEUP' ? t('existingMakeup') : t('existing')}
                      name={nameOf(hit)}
                      time={range(hit.startsAtUtc, hit.durationMin)}
                    />
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PairCard({
  label,
  name,
  time,
  tint = false,
}: {
  label: string;
  name: string;
  time: string;
  tint?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-item px-4 py-3',
        tint ? 'bg-tint-indigo text-tint-foreground' : 'bg-secondary',
      )}
    >
      <span className="text-[11px] leading-4 font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="truncate text-[15px] leading-5 font-semibold">{name}</span>
      <span className="text-sm text-muted-foreground tabular-nums">{time}</span>
    </div>
  );
}
