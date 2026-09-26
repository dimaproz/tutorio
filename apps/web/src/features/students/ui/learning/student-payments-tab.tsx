'use client';

import {
  ArrowDownIcon,
  BanknoteIcon,
  CreditCardIcon,
  RotateCcwIcon,
  WalletIcon,
  WalletCardsIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import type { PackageResponse, PaymentMethodDto, PaymentResponse } from '@tutorio/validation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import {
  ledgerMonths,
  ledgerSummary,
  type CurrencySums,
  type LedgerRow,
} from '@/features/students/model/money-history';
import { cn } from '@/lib/utils';
import { useLearningFormat } from './use-learning-format';

const METHOD_ICON: Record<PaymentMethodDto, typeof BanknoteIcon> = {
  CASH: BanknoteIcon,
  BANK_TRANSFER: CreditCardIcon,
  CARD: CreditCardIcon,
  OTHER: WalletIcon,
};

const GRID = 'md:grid md:grid-cols-[76px_minmax(0,1fr)_100px_90px] md:items-center md:gap-3.5';

/**
 * «Оплати» (board 01, state 13): three tiles — all paid, refunded, the last
 * payment —, then every payment and refund by month: the date, what it paid
 * for, the method and the amount, a refund in red. Sums stay per currency.
 */
export function StudentPaymentsTab({
  payments,
  packages,
  directionNames,
  loading,
  error,
  onRetry,
}: {
  payments: readonly PaymentResponse[];
  packages: readonly PackageResponse[];
  /** Each direction's name, by enrollment. */
  directionNames: ReadonlyMap<string, string>;
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations('students.paymentsTab');
  const format = useLearningFormat();
  const timeZone = useStudioTimeZone();

  if (error) return <QueryErrorAlert error={error} title={t('error')} onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-tile" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full rounded-row" />
        ))}
      </div>
    );
  }
  const months = ledgerMonths(payments, packages, timeZone);
  if (months.length === 0) {
    return (
      <EmptyState
        icon={<WalletCardsIcon />}
        title={t('empty')}
        text={t('emptyText')}
        minHeight={200}
      />
    );
  }

  const summary = ledgerSummary(payments);
  const sums = (rows: CurrencySums) =>
    rows.length === 0
      ? format.money(0, payments[0]?.currency ?? 'UAH')
      : rows.map((row) => format.money(row.amountMinor, row.currency)).join(' · ');

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Tile label={t('paidTotal')} value={sums(summary.paid)} />
        <Tile label={t('refunded')} value={sums(summary.refunded)} />
        <Tile
          label={t('lastPayment')}
          value={summary.lastPaidAt ? format.shortDay(summary.lastPaidAt) : '—'}
          className="hidden md:flex"
        />
      </div>
      {months.map((month) => (
        <section
          key={month.key}
          aria-label={format.monthYear(month.month)}
          className="flex flex-col gap-0.5"
        >
          <h3 className="mt-1.5 text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            {format.monthYear(month.month)}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {month.rows.map((row) => (
              <LedgerItem
                key={row.payment.id}
                row={row}
                directionName={directionNames.get(row.payment.enrollmentId) ?? ''}
                format={format}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-field bg-background px-3.5 py-3', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums text-[17px] font-bold">{value}</span>
    </div>
  );
}

function LedgerItem({
  row,
  directionName,
  format,
}: {
  row: LedgerRow;
  directionName: string;
  format: ReturnType<typeof useLearningFormat>;
}) {
  const t = useTranslations('students.paymentsTab');
  const { payment, pkg } = row;
  const refund = row.kind === 'refund';
  const MethodIcon = METHOD_ICON[payment.method];
  const title = refund
    ? t('refund')
    : pkg
      ? t('forPackage', { name: pkg.name ?? t('unnamed') })
      : t('forLessons');
  const detail = [
    pkg
      ? refund
        ? t('refundOf', { name: pkg.name ?? t('unnamed') })
        : t('packageLessons', { count: pkg.lessonsTotal })
      : payment.settledLessons
        ? t('settledLessons', { count: payment.settledLessons })
        : null,
    directionName || null,
    payment.note,
  ]
    .filter(Boolean)
    .join(' · ');
  const amount = `${refund ? '−' : ''}${format.money(payment.amountMinor, payment.currency)}`;
  const method = t(`methods.${payment.method}`);

  return (
    <li
      className={cn('flex items-center gap-3 rounded-tile px-3 py-2.5 md:min-h-16 md:py-0', GRID)}
    >
      <span className="hidden tabular-nums text-sm font-semibold whitespace-nowrap md:block">
        {format.shortDay(payment.paidAt)}
      </span>
      <div className="flex min-w-0 grow items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-item [&_svg]:size-4.5',
            refund
              ? 'bg-tint-danger text-tint-danger-foreground'
              : 'bg-tint-success text-tint-success-foreground',
          )}
        >
          {refund ? <RotateCcwIcon /> : <ArrowDownIcon />}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="truncate text-xs text-muted-foreground">
            <span className="md:hidden">{`${format.shortDay(payment.paidAt)} · ${method}${detail ? ' · ' : ''}`}</span>
            {detail}
          </span>
        </div>
      </div>
      <span className="hidden items-center gap-2 text-[13px] text-muted-foreground md:inline-flex [&_svg]:size-3.75">
        <MethodIcon aria-hidden="true" />
        {method}
      </span>
      <span
        className={cn(
          'shrink-0 text-right tabular-nums text-[15px] font-bold',
          refund ? 'text-tint-danger-foreground' : 'text-foreground',
        )}
      >
        {amount}
      </span>
    </li>
  );
}
