'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { StatBlock, type StatBlockProps } from '@/components/shared/stat-block';
import {
  LOW_CREDIT_THRESHOLD,
  type CollectionMetrics,
} from '@/features/students/model/collection-metrics';
import { formatMoneyCompact } from '@/lib/money';

type CountQuery = { data?: { total: number }; isPending: boolean; isError: boolean };

export type WeekLessons = { total: number; individual: number; group: number; range: string };

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
  onTopUp,
}: {
  activeQuery: CountQuery;
  totalQuery: CountQuery;
  /** Lessons this week: undefined while loading, null when unavailable. */
  lessonsThisWeek?: WeekLessons | null;
  /** Package-derived metrics, or null when they cannot be computed. */
  metrics?: CollectionMetrics | null;
  /** Opens where a tutor tops up a running-out package. */
  onTopUp?: () => void;
}) {
  const t = useTranslations('students.metrics');
  const locale = useLocale();

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-4 [&>*]:w-65 [&>*]:shrink-0 md:[&>*]:w-auto">
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
            String(lessonsThisWeek.total)
          )
        }
        badge={lessonsThisWeek ? { label: lessonsThisWeek.range, tone: 'neutral' } : undefined}
        caption={
          lessonsThisWeek === null
            ? t('unavailable')
            : lessonsThisWeek === undefined
              ? undefined
              : lessonsThisWeek.total === 0
                ? t('lessonsNone')
                : t('lessonsSplit', {
                    individual: lessonsThisWeek.individual,
                    group: lessonsThisWeek.group,
                  })
        }
      />

      <LowOnCreditsBlock metrics={metrics} onTopUp={onTopUp} />

      {metrics && metrics.unpaidPackages === 0 ? (
        // A clear state is a sentence, so it takes the smaller date-type value.
        <StatBlock
          type="date"
          tone="tint"
          label={t('awaitingPayment')}
          value={t('awaitingPaymentClearValue')}
          badge={{ label: t('awaitingPaymentClearBadge'), tone: 'success' }}
          caption={t('awaitingPaymentClearCaption')}
        />
      ) : (
        <StatBlock
          type="amount"
          tone="tint"
          label={t('awaitingPayment')}
          {...awaitingPaymentValue(metrics, locale, t)}
        />
      )}
    </div>
  );
}

/**
 * Running low is the one metric whose good state is zero, so it earns a
 * different shape: a reassurance rather than a bare 0 followed by "students".
 */
function LowOnCreditsBlock({
  metrics,
  onTopUp,
}: {
  metrics?: CollectionMetrics | null;
  onTopUp?: () => void;
}) {
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
    return (
      <StatBlock type="amount" label={t('lowOnCredits')} value="" caption={t('unavailable')} />
    );
  }

  if (metrics.lowOnCredits === 0) {
    return (
      <StatBlock
        type="date"
        label={t('lowOnCredits')}
        value={t('lowOnCreditsClearValue')}
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
      caption={onTopUp ? undefined : t('lowOnCreditsCaption')}
      action={onTopUp ? { label: t('topUp'), onClick: onTopUp } : undefined}
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

  const money = formatMoneyCompact(metrics.outstandingMinor, metrics.outstandingCurrency, locale);

  return {
    value: money.value,
    unit: money.symbol,
    badge: {
      label: t('packagesUnit', { count: metrics.unpaidPackages }),
      tone: 'warning',
    },
    caption: t('awaitingPaymentCaption'),
  };
}
