'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock, type StatBlockProps } from '@/components/shared/stat-block';
import {
  LOW_CREDIT_THRESHOLD,
  type CollectionMetrics,
} from '@/features/students/model/collection-metrics';
import { formatMoneyDisplay } from '@/lib/money';

type CountQuery = { data?: { total: number }; isPending: boolean; isError: boolean };

/**
 * The four collection metrics.
 *
 * Every number here is measured, never assumed: the counts come from their own
 * queries, the weekly total from the week's lessons, and the money metrics from
 * the workspace's packages. When a metric genuinely cannot be computed the
 * block says so instead of printing a figure nobody can trust.
 */
export function StudentsListMetrics({
  activeQuery,
  totalQuery,
  lessonsThisWeek,
  metrics,
}: {
  activeQuery: CountQuery;
  totalQuery: CountQuery;
  /** Lessons this week: undefined while loading, null when unavailable. */
  lessonsThisWeek?: number | null;
  /** Package-derived metrics, or null when they cannot be computed. */
  metrics?: CollectionMetrics | null;
}) {
  const t = useTranslations('students.metrics');
  const locale = useLocale();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatBlock
        type="amount"
        tone="accent"
        label={t('active')}
        value={
          activeQuery.isPending ? (
            <Skeleton className="h-10 w-16" />
          ) : activeQuery.isError ? (
            t('unavailable')
          ) : (
            String(activeQuery.data?.total ?? 0)
          )
        }
        caption={
          totalQuery.isPending || totalQuery.isError
            ? t('unavailable')
            : t('ofTotal', { total: totalQuery.data?.total ?? 0 })
        }
      />

      <StatBlock
        type="amount"
        label={t('lessonsThisWeek')}
        value={
          lessonsThisWeek === undefined ? (
            <Skeleton className="h-10 w-16" />
          ) : lessonsThisWeek === null ? (
            ''
          ) : (
            String(lessonsThisWeek)
          )
        }
        caption={
          lessonsThisWeek === null
            ? t('unavailable')
            : lessonsThisWeek === 0
              ? t('lessonsNone')
              : t('lessonsCaption')
        }
      />

      <LowOnCreditsBlock metrics={metrics} />

      <StatBlock
        type="amount"
        tone="tint"
        label={t('awaitingPayment')}
        {...awaitingPaymentValue(metrics, locale, t)}
      />
    </div>
  );
}

/**
 * Running low is the one metric whose good state is zero, so it earns a
 * different shape: a reassurance rather than a bare 0 followed by "students".
 */
function LowOnCreditsBlock({ metrics }: { metrics?: CollectionMetrics | null }) {
  const t = useTranslations('students.metrics');

  if (metrics === undefined) {
    return (
      <StatBlock
        type="amount"
        label={t('lowOnCredits')}
        value={<Skeleton className="h-10 w-16" />}
      />
    );
  }

  if (metrics === null) {
    return <StatBlock type="amount" label={t('lowOnCredits')} value="" caption={t('unavailable')} />;
  }

  if (metrics.lowOnCredits === 0) {
    return (
      <StatBlock
        type="amount"
        tone="accent"
        label={t('lowOnCredits')}
        value={t('lowOnCreditsClearValue')}
        badge={{ label: t('lowOnCreditsClearBadge'), tone: 'success' }}
        caption={t('lowOnCreditsClearCaption')}
      />
    );
  }

  return (
    <StatBlock
      type="amount"
      label={t('lowOnCredits')}
      value={String(metrics.lowOnCredits)}
      unit={t('studentsUnit', { count: metrics.lowOnCredits })}
      badge={{ label: t('lowOnCreditsBadge', { count: LOW_CREDIT_THRESHOLD }), tone: 'warning' }}
      caption={t('lowOnCreditsCaption')}
    />
  );
}

function awaitingPaymentValue(
  metrics: CollectionMetrics | null | undefined,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): Pick<Extract<StatBlockProps, { type: 'amount' }>, 'value' | 'unit' | 'caption' | 'badge'> {
  if (metrics === undefined) {
    return { value: <Skeleton className="h-10 w-24" /> };
  }

  if (metrics === null) {
    return { value: '', caption: t('unavailable') };
  }

  if (metrics.unpaidPackages === 0) {
    return {
      value: t('awaitingPaymentClearValue'),
      badge: { label: t('awaitingPaymentClearBadge'), tone: 'success' },
      caption: t('awaitingPaymentClearCaption'),
    };
  }

  // Mixed currencies cannot be added, so the count carries the meaning.
  if (metrics.outstandingMinor == null || metrics.outstandingCurrency == null) {
    return {
      value: String(metrics.unpaidPackages),
      unit: t('packagesUnit', { count: metrics.unpaidPackages }),
      caption: t('awaitingPaymentMixed'),
    };
  }

  const money = formatMoneyDisplay(metrics.outstandingMinor, metrics.outstandingCurrency, locale);
  const [amount, ...rest] = money.split(' ');

  return {
    value: amount ?? money,
    unit: rest.join(' ') || undefined,
    badge: {
      label: t('packagesUnit', { count: metrics.unpaidPackages }),
      tone: 'warning',
    },
    caption: t('awaitingPaymentCaption'),
  };
}
