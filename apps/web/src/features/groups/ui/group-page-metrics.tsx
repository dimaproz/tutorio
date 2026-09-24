'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { GroupAttendanceResponse, GroupDetail, PackageResponse } from '@tutorio/validation';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock, type StatBlockProps } from '@/components/shared/stat-block';
import {
  attendanceSegments,
  memberPackagesPaid,
  onHoldCount,
} from '@/features/groups/model/presentation';
import { formatMoneyCompact } from '@/lib/money';

type Read<T> = { data?: T | null; loading: boolean };

/**
 * The group's four metrics: students (with who is on a break and the free
 * seats), lessons taught, attendance over the last lessons, and the members'
 * packages paid. Every figure is measured; a metric the data cannot back
 * explains itself instead. Phones get the same story as 2×2 tiles.
 */
export function GroupPageMetrics({
  group,
  packages,
  attendance,
}: {
  group: GroupDetail;
  /** One package per member: `memberPackages`. */
  packages: Read<readonly PackageResponse[]>;
  attendance: Read<GroupAttendanceResponse>;
}) {
  const t = useTranslations('groups.stats');
  const locale = useLocale();
  const skeleton = <Skeleton className="h-10 w-20" />;
  const students = group.enrollments.length;
  const onHold = onHoldCount(group.enrollments);
  const memberPackages = packages.data ?? [];
  const paid = memberPackagesPaid(memberPackages);
  const money = (minor: number) =>
    memberPackages[0] ? formatMoneyCompact(minor, memberPackages[0].currency, locale).text : '';
  const rate = attendance.data?.stats.rate ?? null;

  const studentsBlock: StatBlockProps = {
    type: 'amount',
    label: t('students'),
    value: String(students),
    badge: onHold > 0 ? { label: t('onHoldBadge', { count: onHold }), tone: 'warning' } : undefined,
    caption:
      group.capacity !== null
        ? t('freeSeats', { count: Math.max(0, group.capacity - students) })
        : students === 0
          ? t('addFirst')
          : t('noCapacity'),
  };

  const heldBlock: StatBlockProps = {
    type: 'amount',
    label: t('held'),
    value: String(group.lessonCounts.completed),
    caption: group.schedules.length > 0 ? t('heldCaption') : t('noSchedule'),
  };

  const attendanceBlock: StatBlockProps = attendance.loading
    ? { type: 'amount', label: t('attendance'), value: skeleton }
    : rate !== null && attendance.data
      ? {
          type: 'chart',
          chart: 'segments',
          label: t('attendance'),
          value: `${Math.round(rate * 100)}%`,
          data: attendanceSegments(attendance.data),
          caption: t('attendanceCaption', { count: attendance.data.stats.lessons }),
        }
      : {
          type: 'date',
          label: t('attendance'),
          value: t('attendanceNone'),
          sub: t('attendanceNoneSub'),
          caption: t('attendanceNoneCaption'),
        };

  const pending = paid.total - paid.paid;
  const packagesBlock: StatBlockProps = packages.loading
    ? { type: 'amount', tone: 'tint', label: t('packagesPaid'), value: skeleton }
    : paid.total > 0
      ? {
          type: 'amount',
          tone: 'tint',
          label: t('packagesPaid'),
          value: t('packagesPaidValue', { paid: paid.paid, total: paid.total }),
          badge:
            pending > 0
              ? { label: t('pendingBadge', { count: pending }), tone: 'warning' }
              : undefined,
          caption: t('packagesPaidCaption', {
            paid: money(paid.paidMinor),
            total: money(paid.totalMinor),
          }),
        }
      : {
          type: 'date',
          tone: 'tint',
          label: t('packageLabel'),
          value: t('packageNone'),
          sub: t('packageNoneSub'),
          caption: t('packageNoneCaption'),
        };
  const phone = [studentsBlock, heldBlock, attendanceBlock, packagesBlock];

  return (
    <>
      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        <StatBlock {...studentsBlock} />
        <StatBlock {...heldBlock} />
        <StatBlock {...attendanceBlock} />
        <StatBlock {...packagesBlock} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {phone.map((block) => (
          <StatBlock key={block.label} {...block} size="sm" />
        ))}
      </div>
    </>
  );
}
