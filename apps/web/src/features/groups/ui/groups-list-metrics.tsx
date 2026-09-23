'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { GroupSummaryResponse } from '@tutorio/validation';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock } from '@/components/shared/stat-block';

/**
 * The four collection metrics, all from one summary read: active groups,
 * students in groups, lessons this week and groups with money outstanding.
 * "Unpaid" is the one with a command: it filters the list to those groups.
 * A failed read says so instead of printing zeros.
 */
export function GroupsListMetrics({
  summary,
  loading,
  onShowUnpaid,
}: {
  summary?: GroupSummaryResponse;
  loading: boolean;
  onShowUnpaid: () => void;
}) {
  const t = useTranslations('groups.metrics');
  const format = useFormatter();
  const placeholder = <Skeleton className="h-10 w-16" />;
  const value = (figure: number | undefined) =>
    loading ? placeholder : figure === undefined ? '' : String(figure);
  const unavailable = !loading && !summary ? t('unavailable') : undefined;

  const range = summary
    ? format.dateTimeRange(new Date(summary.weekStart), new Date(Date.parse(summary.weekEnd) - 1), {
        weekday: 'short',
      })
    : '';

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-4 [&>*]:w-65 [&>*]:shrink-0 md:[&>*]:w-auto">
      <StatBlock
        type="amount"
        label={t('active')}
        value={value(summary?.active)}
        badge={summary?.empty ? { label: t('emptyBadge', { count: summary.empty }), tone: 'warning' } : undefined}
        caption={unavailable ?? (summary ? t('activeCaption', { count: summary.total }) : undefined)}
      />
      <StatBlock
        type="amount"
        tone="tint"
        label={t('students')}
        value={value(summary?.studentsInGroups)}
        badge={
          summary?.freeSeats
            ? { label: t('freeSeatsBadge', { count: summary.freeSeats }), tone: 'neutral' }
            : undefined
        }
        caption={
          unavailable ?? (summary ? t('studentsCaption', { total: summary.studioStudents }) : undefined)
        }
      />
      <StatBlock
        type="amount"
        label={t('lessons')}
        value={value(summary?.lessonsThisWeek)}
        caption={
          unavailable ??
          (summary ? t('lessonsCaption', { range, today: summary.lessonsToday }) : undefined)
        }
      />
      {summary && summary.unpaidGroups === 0 ? (
        // A clear state is a sentence, so it takes the smaller date-type value.
        <StatBlock
          type="date"
          label={t('unpaid')}
          value={t('unpaidClearValue')}
          caption={t('unpaidClearCaption')}
        />
      ) : (
        <StatBlock
          type="amount"
          label={t('unpaid')}
          value={value(summary?.unpaidGroups)}
          badge={summary ? { label: t('unpaidBadge'), tone: 'warning' } : undefined}
          caption={unavailable ?? (summary ? t('unpaidCaption') : undefined)}
          action={summary ? { label: t('unpaidAction'), onClick: onShowUnpaid } : undefined}
        />
      )}
    </div>
  );
}
