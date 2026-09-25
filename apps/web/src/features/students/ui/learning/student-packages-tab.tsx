'use client';

import { PackageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PackageResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import {
  packageHistory,
  packageSummary,
  type PackageState,
} from '@/features/students/model/money-history';
import { cn } from '@/lib/utils';
import { useLearningFormat } from './use-learning-format';

const STATE_BADGE: Record<PackageState, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  used: 'neutral',
  expired: 'warning',
};

const GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_120px_150px_80px] md:items-center md:gap-3.5';

/**
 * «Пакети» (board 01, state 12): every package the student has had, newest
 * first — what it was, when it was bought and until when, its credits used,
 * its state and what is paid —, with a summary line under the list. The
 * block above shows the current state; this tab is the history (decision 11).
 */
export function StudentPackagesTab({
  packages,
  loading,
  error,
  onRetry,
  nowMs,
}: {
  packages: readonly PackageResponse[];
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  nowMs: number;
}) {
  const t = useTranslations('students.packagesTab');
  const format = useLearningFormat();

  if (error) return <QueryErrorAlert error={error} title={t('error')} onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full rounded-row" />
        ))}
      </div>
    );
  }
  if (packages.length === 0) {
    return (
      <EmptyState icon={<PackageIcon />} title={t('empty')} text={t('emptyText')} minHeight={200} />
    );
  }

  const rows = packageHistory(packages, nowMs);
  const summary = packageSummary(packages);
  return (
    <div className="flex flex-col gap-2">
      <div
        aria-hidden="true"
        className={cn(
          'hidden border-b border-border px-3 pt-1 pb-2 text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase',
          GRID,
        )}
      >
        <span>{t('columns.package')}</span>
        <span>{t('columns.lessons')}</span>
        <span>{t('columns.state')}</span>
        <span className="text-right">{t('columns.price')}</span>
      </div>
      <ul className="flex flex-col gap-0.5" aria-label={t('label')}>
        {rows.map(({ pkg, state }) => {
          const paid = pkg.paymentStatus === 'PAID';
          const valid = pkg.expiresAt
            ? t('until', { date: format.shortDay(new Date(Date.parse(pkg.expiresAt) - 1)) })
            : null;
          return (
            <li
              key={pkg.id}
              className={cn('flex flex-col gap-2 rounded-tile px-3 py-3 md:min-h-18 md:py-0', GRID)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-item [&_svg]:size-5',
                    state === 'active'
                      ? 'bg-tint-indigo text-brand'
                      : 'bg-background text-muted-foreground',
                  )}
                >
                  <PackageIcon />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      'truncate text-sm font-semibold',
                      state !== 'active' && 'text-muted-foreground',
                    )}
                  >
                    {pkg.name ?? t('unnamed')}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[t('bought', { date: format.shortDay(pkg.purchasedAt) }), valid]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <span
                  className={cn(
                    'ml-auto font-mono text-sm font-semibold md:hidden',
                    state !== 'active' && 'text-muted-foreground',
                  )}
                >
                  {format.money(pkg.totalPriceMinorSnapshot, pkg.currency)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <CreditMeter left={pkg.remainingCredits} total={pkg.lessonsTotal} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {t('used', { used: pkg.consumedCredits, total: pkg.lessonsTotal })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start md:gap-1">
                <Badge variant={STATE_BADGE[state]} size="sm">
                  {t(`states.${state}`)}
                </Badge>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[13px] font-medium',
                    paid ? 'text-tint-success-foreground' : 'text-tint-warning-foreground',
                  )}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
                  {paid
                    ? t('paid')
                    : t('paidOf', {
                        paid: format.money(pkg.paidMinor, pkg.currency),
                        total: format.money(pkg.totalPriceMinorSnapshot, pkg.currency),
                      })}
                </span>
              </div>
              <span
                className={cn(
                  'hidden text-right font-mono text-sm font-semibold md:block',
                  state !== 'active' && 'text-muted-foreground',
                )}
              >
                {format.money(pkg.totalPriceMinorSnapshot, pkg.currency)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-1 pt-2 text-[13px] text-muted-foreground">
        {[
          t('summaryCount', { count: summary.count }),
          t('summaryUsed', { used: summary.used, total: summary.total }),
          summary.paid.length > 0
            ? t('summaryPaid', {
                amount: summary.paid
                  .map((sum) => format.money(sum.amountMinor, sum.currency))
                  .join(' · '),
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}
