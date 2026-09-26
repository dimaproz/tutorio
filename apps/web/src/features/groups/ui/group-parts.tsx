'use client';

import { CalendarIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { GroupListItem, GroupSchedule } from '@tutorio/validation';
import { AvatarGroup } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { scheduleSlots } from '@/features/groups/model/presentation';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { cn } from '@/lib/utils';

export type GroupLifecycle = 'ACTIVE' | 'EMPTY' | 'ARCHIVED';

const DOT_TONE = { ACTIVE: 'success', EMPTY: 'archived', ARCHIVED: 'warning' } as const;

/** The group's state: active, empty (no live roster) or archived. */
export function GroupStatusBadge({
  status,
  onTint = false,
}: {
  status: GroupLifecycle;
  /** A white chip for the indigo hero, where a tint would disappear. */
  onTint?: boolean;
}) {
  const t = useTranslations('groups.status');
  if (status === 'ACTIVE') {
    return (
      <Badge
        variant={onTint ? 'surface' : 'success-inverse'}
        size="lg"
        dot
        dotTone={DOT_TONE[status]}
      >
        {t(status)}
      </Badge>
    );
  }
  return (
    <Badge variant={onTint ? 'surface' : status === 'ARCHIVED' ? 'warning' : 'neutral'} size="lg">
      {t(status)}
    </Badge>
  );
}

/** "Вт 17:00" pills, one per weekday of every live pattern, Monday first. */
export function GroupSchedulePills({
  schedules,
  size = 'md',
  className,
}: {
  schedules: readonly GroupSchedule[];
  size?: 'md' | 'sm';
  className?: string;
}) {
  const t = useTranslations('groups.row');
  const weekdays = useWeekdayLabels();
  const slots = scheduleSlots(schedules);
  if (slots.length === 0) {
    return <span className="text-sm text-muted-foreground">{t('noSchedule')}</span>;
  }
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {slots.map((slot) => (
        <li
          key={`${slot.weekday}-${slot.localTime}`}
          className={cn(
            'inline-flex items-center gap-2 rounded-control bg-tile-indigo text-foreground tabular-nums',
            size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-sm',
          )}
        >
          <span className="font-sans font-semibold tracking-[0.04em] uppercase">
            {weekdays[slot.weekday]}
          </span>
          {slot.localTime}
        </li>
      ))}
    </ul>
  );
}

/** Overlapping roster avatars with "6 of 8 seats" (or just the count). */
export function GroupRosterStack({
  group,
  max = 5,
  short = false,
}: {
  group: Pick<GroupListItem, 'students' | 'activeStudentCount' | 'capacity'>;
  max?: number;
  /** "6 of 8" instead of "6 of 8 seats", for the table column. */
  short?: boolean;
}) {
  const t = useTranslations('groups.row');
  if (group.activeStudentCount === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {short ? t('noStudentsShort') : t('noStudents')}
      </span>
    );
  }
  const label =
    group.capacity !== null
      ? t(short ? 'seatsShort' : 'seats', {
          count: group.activeStudentCount,
          capacity: group.capacity,
        })
      : t('studentCount', { count: group.activeStudentCount });
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AvatarGroup aria-hidden="true" className="shrink-0">
        {group.students.slice(0, max).map((student) => (
          <EntityAvatar
            key={student.id}
            avatarKey={student.avatarKey}
            fullName={student.fullName}
            tint="indigo"
            size="sm"
          />
        ))}
      </AvatarGroup>
      <span className="truncate text-sm tabular-nums">{label}</span>
    </div>
  );
}

/** The next lesson with a calendar glyph, or "no lessons planned". */
export function GroupNextLesson({ startsAtUtc }: { startsAtUtc: string | null }) {
  const t = useTranslations('groups.row');
  const format = useFormatter();
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <CalendarIcon aria-hidden="true" className="size-4 shrink-0 text-brand" />
      <span className={cn('truncate', !startsAtUtc && 'text-muted-foreground')}>
        {startsAtUtc
          ? `${format.dateTime(new Date(startsAtUtc), { weekday: 'short', day: 'numeric', month: 'short' })} · ${format.dateTime(new Date(startsAtUtc), { hour: '2-digit', minute: '2-digit' })}`
          : t('noLesson')}
      </span>
    </span>
  );
}
