import { replaceSlot } from '@tutorio/domain';
import {
  scheduleConflictSchema,
  type ScheduleChangeDto,
  type ScheduleConflict,
  type ScheduleResponse,
  type ScheduleSlotDto,
} from '@tutorio/validation';
import { z } from 'zod';
import type { GatewayError } from '@/lib/auth/client';

/** Weekday (0 = Sunday) and "HH:mm" of an instant in a timezone. */
export function localSlotOf(instant: string, timeZone: string): ScheduleSlotDto {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  return { weekday, localTime: `${part('hour')}:${part('minute')}` };
}

/**
 * The schedule after "this and following" (L-41): the lesson's weekday takes
 * the new day and time from this lesson on; the other weekdays stay. The API
 * builds the same slots when it applies the move.
 */
export function movedSlots(
  schedule: Pick<ScheduleResponse, 'slots' | 'timezone'>,
  fromStartsAt: string,
  toStartsAt: string,
): ScheduleSlotDto[] {
  const from = localSlotOf(fromStartsAt, schedule.timezone);
  const to = localSlotOf(toStartsAt, schedule.timezone);
  const current = schedule.slots.map(({ weekday, localTime }) => ({ weekday, localTime }));
  return replaceSlot(current, from.weekday, to);
}

/** The change the "this and following" preview asks about. */
export function moveChange(
  schedule: Pick<ScheduleResponse, 'slots' | 'timezone' | 'durationMin'>,
  fromStartsAt: string,
  toStartsAt: string,
  durationMin?: number,
): ScheduleChangeDto {
  return {
    effectiveFrom: fromStartsAt,
    slots: movedSlots(schedule, fromStartsAt, toStartsAt),
    durationMin: durationMin ?? schedule.durationMin,
  };
}

const conflictDetailsSchema = z.object({ conflicts: z.array(scheduleConflictSchema) });

/** The overlaps of a 409 SCHEDULE_CONFLICT (L-110), or null for any other error. */
export function scheduleConflicts(error: unknown): ScheduleConflict[] | null {
  const gateway = error as Partial<GatewayError> | null;
  if (!gateway || gateway.code !== 'SCHEDULE_CONFLICT') return null;
  const parsed = conflictDetailsSchema.safeParse(gateway.details);
  return parsed.success ? parsed.data.conflicts : [];
}
