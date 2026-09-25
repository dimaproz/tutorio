'use client';

import { useMemo } from 'react';
import { useDirectionScheduleQuery, useStudentDirectionsQuery, useStudentQuery } from '../../api';
import type { SaleDirection } from '../../model/sale';

/** The package a direction uses now (L-81): the oldest usable one with credits, else the newest usable. */
function currentPackage(direction: SaleDirection) {
  const usable = direction.packages.filter((pkg) => pkg.usable);
  return usable.find((pkg) => pkg.remainingCredits > 0) ?? usable.at(-1) ?? null;
}

/**
 * What the sale needs about its target: the student, their live directions,
 * the one picked (the given one, else the first), its schedule (its own, or
 * its group's) and the package it uses now.
 */
export function useSaleData(studentId: string | null, enrollmentId: string | null) {
  const student = useStudentQuery(studentId ?? '', Boolean(studentId));
  const billing = useStudentDirectionsQuery(studentId);
  const directions = useMemo(
    () => (billing.data?.directions ?? []).filter((direction) => direction.status !== 'ARCHIVED'),
    [billing.data],
  );
  const direction =
    directions.find((row) => row.enrollmentId === enrollmentId) ?? directions[0] ?? null;
  const schedules = useDirectionScheduleQuery(
    direction
      ? direction.group
        ? { groupId: direction.group.id }
        : { studentId: studentId ?? undefined }
      : null,
  );
  const schedule =
    direction && schedules.data
      ? (schedules.data.items.find((row) =>
          direction.group
            ? row.groupId === direction.group.id
            : row.enrollmentId === direction.enrollmentId,
        ) ?? null)
      : null;
  return {
    student: student.data ?? null,
    directions,
    direction,
    schedule,
    current: direction ? currentPackage(direction) : null,
    loading: Boolean(studentId) && (student.isPending || billing.isPending),
  };
}

export type SaleData = ReturnType<typeof useSaleData>;
