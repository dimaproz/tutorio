'use client';

import { CalendarClockIcon, CirclePauseIcon, InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import type { PackageDetailResponse } from '@tutorio/validation';
import { Notice } from '@/components/shared/notice';
import { StatBlock } from '@/components/shared/stat-block';
import { daysBetween, lastDayOf } from '../model/dates';
import { owedMinor, paidPercent, pauseDays, ticketNotice, type TicketState } from '../model/ticket';
import type { PackageFormat } from './use-package-format';

/**
 * The ticket's two metrics on their panel (board 02): «Діє до» as a date
 * block with how long is left or since when it expired, and «Сплачено» as a
 * ring; on phones the small tiles. Under them the callout that explains the
 * state: expired, used up, moved by a pause, or waiting behind another
 * package (L-81, L-84, L-102).
 */
export function TicketMetrics({
  pkg,
  state,
  payments,
  studentFirstName,
  now,
  mobile,
  format,
}: {
  pkg: PackageDetailResponse;
  state: TicketState;
  payments: number;
  studentFirstName: string;
  now: Date;
  mobile: boolean;
  format: PackageFormat;
}) {
  const t = useTranslations('packages.ticket');
  const timeZone = useStudioTimeZone();
  const currency = pkg.currency;
  const lastDay = pkg.expiresAt ? lastDayOf(pkg.expiresAt) : null;
  const days = lastDay ? daysBetween(now, lastDay, timeZone) : null;
  const addedDays = pauseDays(pkg);
  const start = pkg.validFrom ?? pkg.purchasedAt;
  const owed = owedMinor(pkg);
  const size = mobile ? 'sm' : 'md';

  const valid = (
    <StatBlock
      type="date"
      size={size}
      label={t('validUntil')}
      value={lastDay ? format.shortDay(lastDay) : t('noEnd')}
      sub={
        days === null
          ? t('noEndSub')
          : days >= 0
            ? t('daysLeft', { count: days })
            : t('daysAgo', { count: -days })
      }
      caption={
        addedDays > 0
          ? t('fromPause', { date: format.shortDay(start), days: addedDays })
          : t('from', { date: format.shortDay(start) })
      }
      badge={
        state === 'expired'
          ? { label: t('badgeExpired'), tone: 'warning' }
          : addedDays > 0
            ? { label: t('badgeExtended'), tone: 'info' }
            : undefined
      }
    />
  );
  const paid = (
    <StatBlock
      type="chart"
      chart="ring"
      size={size}
      percent={paidPercent(pkg)}
      label={t('paid')}
      value={format.money(pkg.paidMinor, currency)}
      caption={t('paidOf', { total: format.money(pkg.totalPriceMinorSnapshot, currency) })}
      detail={t('payments', { count: payments })}
      badge={
        owed > 0
          ? { label: t('badgeLeft', { amount: format.money(owed, currency) }), tone: 'warning' }
          : { label: t('badgePaid'), tone: 'success' }
      }
    />
  );

  const notice = ticketNotice(pkg, state);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 rounded-[26px] bg-background p-2">
        {valid}
        {paid}
      </div>
      {notice?.kind === 'expired' ? (
        <Notice
          tone="warning"
          appearance="callout"
          icon={<CalendarClockIcon />}
          title={t('notice.expiredTitle', {
            date: format.dayMonth(notice.lastDay),
            count: notice.unused,
          })}
          text={t('notice.expiredText')}
        />
      ) : notice?.kind === 'used' ? (
        <Notice
          tone="info"
          appearance="callout"
          icon={<InfoIcon />}
          title={t('notice.usedTitle', { count: notice.total })}
          text={t('notice.usedText')}
        />
      ) : notice?.kind === 'paused' ? (
        <Notice
          tone="info"
          appearance="callout"
          icon={<CirclePauseIcon />}
          title={t('notice.pausedTitle', { days: notice.days })}
          text={t('notice.pausedText', {
            name: studentFirstName,
            range: notice.pauseTo
              ? format.dayRange(notice.pauseFrom, new Date(Date.parse(notice.pauseTo) - 1))
              : format.dayMonth(notice.pauseFrom),
            before: notice.endBefore ? format.dayMonth(notice.endBefore) : '',
            after: notice.endAfter ? format.dayMonth(notice.endAfter) : '',
          })}
        />
      ) : notice?.kind === 'ahead' ? (
        <Notice
          tone="info"
          appearance="callout"
          icon={<InfoIcon />}
          title={
            notice.name
              ? t('notice.aheadTitle', { name: notice.name })
              : t('notice.aheadTitleUnnamed')
          }
          text={
            notice.lastLessonAt
              ? t('notice.aheadUntil', {
                  count: notice.credits,
                  date: format.weekdayDayMonth(notice.lastLessonAt),
                })
              : t('notice.aheadText', { count: notice.credits })
          }
        />
      ) : null}
    </>
  );
}
