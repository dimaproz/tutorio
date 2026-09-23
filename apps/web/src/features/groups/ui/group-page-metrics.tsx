'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { GroupAttendanceResponse, GroupDetail, PackageResponse } from '@tutorio/validation';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock, type StatBlockProps } from '@/components/shared/stat-block';
import { attendanceSegments, onHoldCount, percent } from '@/features/groups/model/presentation';
import { formatMoneyCompact } from '@/lib/money';

type Read<T> = { data?: T | null; loading: boolean };

/**
 * The group's four metrics: students (with who is on a break and the free
 * seats), lessons taught of the package, attendance over the last lessons,
 * and the shares paid. Every figure is measured; a metric the data cannot
 * back explains itself instead. Phones get the same story as 2×2 tiles.
 */
export function GroupPageMetrics({
  group,
  pkg,
  attendance,
}: {
  group: GroupDetail;
  pkg: Read<PackageResponse>;
  attendance: Read<GroupAttendanceResponse>;
}) {
  const t = useTranslations('groups.stats');
  const locale = useLocale();
  const format = useFormatter();
  const skeleton = <Skeleton className="h-10 w-20" />;
  const students = group.enrollments.length;
  const onHold = onHoldCount(group.enrollments);
  const current = pkg.data ?? null;
  const shares = current?.shares ?? [];
  const paidShares = shares.filter((share) => share.paymentStatus === 'PAID').length;
  const money = (minor: number) =>
    current ? formatMoneyCompact(minor, current.currency, locale).text : '';
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

  const heldBlock: StatBlockProps = pkg.loading
    ? { type: 'amount', label: t('held'), value: skeleton }
    : current
      ? {
          type: 'chart',
          chart: 'ring',
          label: t('held'),
          value: t('heldOf', { used: current.consumedCredits, total: current.lessonsTotal }),
          percent: percent(current.consumedCredits, current.lessonsTotal),
          caption: current.name
            ? t('packageCaption', { name: current.name })
            : t('packageCaptionUnnamed'),
          detail: t('left', { count: current.remainingCredits }),
        }
      : {
          type: 'amount',
          label: t('held'),
          value: String(group.lessonCounts.completed),
          caption: group.schedules.length > 0 ? t('heldNoPackage') : t('noSchedule'),
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

  const pending = shares.length - paidShares;
  const sharesBlock: StatBlockProps = pkg.loading
    ? { type: 'amount', tone: 'tint', label: t('shares'), value: skeleton }
    : current && shares.length > 0
      ? {
          type: 'amount',
          tone: 'tint',
          label: t('shares'),
          value: t('sharesValue', { paid: paidShares, total: shares.length }),
          badge: pending > 0 ? { label: t('pendingBadge', { count: pending }), tone: 'warning' } : undefined,
          caption: t('sharesCaption', {
            paid: money(shares.reduce((sum, share) => sum + share.paidMinor, 0)),
            total: money(shares.reduce((sum, share) => sum + share.oweMinor, 0)),
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

  // Phones show the package story when there is one: taught, attendance,
  // what is left and the shares; without one, the roster leads.
  const remainingBlock: StatBlockProps | null = current
    ? {
        type: 'amount',
        label: t('remaining'),
        value: t('remainingValue', { count: current.remainingCredits }),
        caption: current.expiresAt
          ? t('remainingCaption', {
              date: format.dateTime(new Date(current.expiresAt), { day: 'numeric', month: 'short' }),
            })
          : t('remainingCaptionOpen'),
      }
    : null;
  const phone = remainingBlock
    ? [heldBlock, attendanceBlock, remainingBlock, sharesBlock]
    : [studentsBlock, heldBlock, attendanceBlock, sharesBlock];

  return (
    <>
      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        <StatBlock {...studentsBlock} />
        <StatBlock {...heldBlock} />
        <StatBlock {...attendanceBlock} />
        <StatBlock {...sharesBlock} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {phone.map((block) => (
          <StatBlock key={block.label} {...block} size="sm" />
        ))}
      </div>
    </>
  );
}
