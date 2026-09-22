'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock } from '@/components/shared/stat-block';
import { PENDING_VALUE } from '@/features/students/model/pending-data';

type CountQuery = { data?: { total: number }; isPending: boolean; isError: boolean };

function countValue(query: CountQuery, unavailable: string) {
  if (query.isPending) {
    return <Skeleton className="h-10 w-16" />;
  }
  return query.isError ? unavailable : String(query.data?.total ?? 0);
}

/**
 * The four collection metrics. Only the active-student count has an endpoint
 * today; the trend series and the money metrics are placeholders until their
 * aggregates exist, and each says so in its own caption rather than showing a
 * number nobody can trust.
 */
export function StudentsListMetrics({
  activeQuery,
  totalQuery,
}: {
  activeQuery: CountQuery;
  totalQuery: CountQuery;
}) {
  const t = useTranslations('students.metrics');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatBlock
        type="amount"
        tone="accent"
        label={t('active')}
        value={countValue(activeQuery, t('unavailable'))}
        caption={
          totalQuery.isError || totalQuery.isPending
            ? t('error')
            : t('ofTotal', { total: totalQuery.data?.total ?? 0 })
        }
      />
      <StatBlock
        type="amount"
        label={t('lessonsThisWeek')}
        value={PENDING_VALUE}
        caption={t('pending')}
      />
      <StatBlock
        type="amount"
        label={t('lowOnCredits')}
        value={PENDING_VALUE}
        unit={t('studentsUnit')}
        badge={{ label: t('lowOnCreditsBadge'), tone: 'warning' }}
        caption={t('pending')}
      />
      <StatBlock
        type="amount"
        tone="tint"
        label={t('awaitingPayment')}
        value={PENDING_VALUE}
        caption={t('pending')}
      />
    </div>
  );
}
