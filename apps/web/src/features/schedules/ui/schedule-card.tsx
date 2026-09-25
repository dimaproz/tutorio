'use client';

import { useLengthLabel, SlotChips } from '@/features/lessons';
import { cn } from '@/lib/utils';
import { NextCell, ScheduleMedia, StatusCell, type ListSchedule } from './schedule-cells';
import { ScheduleRowMenu, type ScheduleAction } from './schedule-row-menu';

/**
 * A schedule on the phone (S05 phone boards 01–02): who with «teacher · by
 * 60 min», the slot chips, then the state with its caption and the next
 * lesson. The menu opens the same actions as the table's.
 */
export function ScheduleCard({
  schedule,
  now,
  solo,
  onAction,
}: {
  schedule: ListSchedule;
  now: number;
  solo: boolean;
  onAction: (action: ScheduleAction, schedule: ListSchedule) => void;
}) {
  const length = useLengthLabel();
  const ended = schedule.state === 'ENDED';
  return (
    <article
      className={cn(
        'flex flex-col gap-3.5 rounded-card bg-card p-4',
        ended && 'text-muted-foreground',
      )}
    >
      <div className="flex items-start gap-3">
        <ScheduleMedia schedule={schedule} size="sm" />
        <div className="flex min-w-0 grow flex-col">
          <span className="truncate text-[17px] leading-[22px] font-semibold">
            {schedule.group?.name ?? schedule.student?.fullName ?? ''}
          </span>
          <span className="truncate text-sm leading-5 text-muted-foreground">
            {solo
              ? length(schedule.durationMin)
              : `${schedule.teacher.name} · ${length(schedule.durationMin)}`}
          </span>
        </div>
        <ScheduleRowMenu schedule={schedule} onAction={onAction} />
      </div>
      <SlotChips slots={schedule.slots} />
      <div className="flex items-end justify-between gap-3">
        <StatusCell schedule={schedule} />
        <NextCell schedule={schedule} now={now} align="end" />
      </div>
    </article>
  );
}
