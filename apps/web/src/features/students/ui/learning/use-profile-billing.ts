'use client';

import { useMemo } from 'react';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import {
  useDirectionSchedules,
  useStudentBillingQuery,
  useStudentPausesQuery,
  useStudentPaymentsQuery,
} from '@/features/students/api';
import {
  balanceMetric,
  directionName,
  moneyMetric,
  visibleDirections,
} from '@/features/students/model/learning';

/**
 * The billing reads of a student profile (S06): the directions with how
 * each is paid, the current pauses, the directions' schedules and the
 * payments, with what the page derives from them — the banner's pause, the
 * first two metrics and the direction a payment goes to by default.
 */
export function useProfileBilling(studentId: string, nowMs: number) {
  const timeZone = useStudioTimeZone();
  const billing = useStudentBillingQuery(studentId);
  const pauses = useStudentPausesQuery(studentId);
  const payments = useStudentPaymentsQuery(studentId);
  const groupIds = useMemo(
    () =>
      (billing.data?.directions ?? []).flatMap((direction) =>
        direction.group ? [direction.group.id] : [],
      ),
    [billing.data],
  );
  const schedules = useDirectionSchedules(studentId, groupIds);

  return useMemo(() => {
    const all = billing.data?.directions ?? [];
    const directions = visibleDirections(all);
    const pauseItems = pauses.data?.items ?? [];
    const live = directions.filter((direction) => direction.status !== 'ARCHIVED');
    return {
      billing,
      pauses,
      payments,
      schedules: schedules.items,
      directions,
      pauseItems,
      /** The running whole-student pause: the banner and «Повернути зараз». */
      running:
        pauseItems.find((pause) => pause.enrollmentId === null && pause.state === 'ACTIVE') ?? null,
      /** The next pause that has not begun, of the student or a direction. */
      scheduled:
        [...pauseItems]
          .filter((pause) => pause.state === 'SCHEDULED')
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
      balance: billing.data ? balanceMetric(all) : undefined,
      money:
        billing.data && payments.data
          ? moneyMetric(all, payments.data.items, nowMs, timeZone)
          : undefined,
      directionNames: new Map(
        all.map((direction) => [direction.enrollmentId, directionName(direction)]),
      ),
      /** Where «Записати оплату» outside a pass goes: money owed first. */
      payTarget:
        live.find(
          (direction) =>
            direction.balance.debtMinor > 0 ||
            direction.packages.some((pkg) => pkg.usable && pkg.paidMinor < pkg.totalPriceMinor),
        ) ??
        live[0] ??
        null,
    };
  }, [billing, pauses, payments, schedules.items, nowMs, timeZone]);
}
