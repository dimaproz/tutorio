'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { DashboardMoneyResponse } from '@tutorio/validation';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { BlockError } from './block-error';

type Currency = DashboardMoneyResponse['currencies'][number];

/** A thin coin with «₴» and a small dot, at 14%: it never competes with the figures. */
function CoinArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 180"
      className="pointer-events-none absolute top-0 right-0 h-45 w-75 opacity-14"
    >
      <circle
        cx="250"
        cy="10"
        r="70"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".35"
        strokeWidth="16"
      />
      <text
        x="250"
        y="42"
        textAnchor="middle"
        fontSize="88"
        fontWeight="800"
        fill="currentColor"
        fillOpacity=".3"
      >
        ₴
      </text>
      <circle cx="60" cy="176" r="26" fill="currentColor" fillOpacity=".18" />
    </svg>
  );
}

function Figure({
  value,
  caption,
  large,
  align,
}: {
  value: string;
  caption: string;
  large: boolean;
  align: 'end' | 'start';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col leading-tight',
        align === 'end' ? 'items-end text-right' : 'items-start',
      )}
    >
      <b
        className={cn(
          'font-bold tracking-[-0.01em] whitespace-nowrap tabular-nums',
          large ? 'text-xl' : 'text-[17px]',
        )}
      >
        {value}
      </b>
      <span className="text-xs text-accent-card-muted">{caption}</span>
    </div>
  );
}

/**
 * «Гроші за місяць» (S11 decision 6, «M2»): the brand indigo card with the
 * coin in its corner — received this month with today's part, the debt now
 * with the debtors, and the approximate amount due within seven days. Always
 * the whole studio; one currency reads as a row per figure, two or more put
 * each label over a grid of currencies. Currencies are never summed.
 */
export function MoneyCard({
  data,
  loading,
  error,
  onRetry,
  month,
}: {
  data?: DashboardMoneyResponse;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** The studio month the figures cover: its number (1–12) and its name. */
  month: { number: number; name: string };
}) {
  const t = useTranslations('today.money');
  const locale = useLocale();
  const money = (amountMinor: number, currency: string) =>
    formatMoneyCompact(amountMinor, currency, locale).text;

  if (error) {
    return (
      <Card data-slot="money-card" className="gap-3 px-5.5 py-5">
        <MoneyHead title={t('title')} scope={t('scope')} />
        <BlockError onRetry={onRetry} />
      </Card>
    );
  }

  if (loading || !data) {
    return (
      <Card data-slot="money-card" aria-busy="true" className="gap-4 px-5.5 py-5">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </Card>
    );
  }

  const rows: {
    key: string;
    label: string;
    value: (row: Currency) => string;
    caption: (row: Currency) => string;
  }[] = [
    {
      key: 'received',
      label: t('received', { month: month.number, name: month.name }),
      value: (row) => money(row.receivedMonthMinor, row.currency),
      caption: (row) =>
        row.receivedTodayMinor > 0
          ? t('today', { amount: money(row.receivedTodayMinor, row.currency) })
          : row.receivedMonthMinor === 0
            ? t('noPayments')
            : t('thisMonth'),
    },
    {
      key: 'debt',
      label: t('debt'),
      value: (row) => (row.debtMinor > 0 ? money(row.debtMinor, row.currency) : t('noDebt')),
      caption: (row) => (row.debtMinor > 0 ? t('debtors', { count: row.debtors }) : ''),
    },
    {
      key: 'due',
      label: t('due'),
      value: (row) => t('approx', { amount: money(row.dueMinor, row.currency) }),
      caption: (row) => t('duePackages', { count: row.duePackages }),
    },
  ];
  const several = data.currencies.length > 1;

  return (
    <Card data-slot="money-card" tone="accent" className="relative gap-1 px-5.5 pt-5 pb-2.5">
      <CoinArt />
      <MoneyHead title={t('title')} scope={t('scope')} />
      <div className="relative flex flex-col">
        {rows.map((row, index) => (
          <MoneyRow key={row.key} first={index === 0} label={row.label} several={several}>
            {data.currencies.map((currency) => (
              <Figure
                key={currency.currency}
                large={index === 0}
                align={several ? 'start' : 'end'}
                value={row.value(currency)}
                caption={row.caption(currency)}
              />
            ))}
          </MoneyRow>
        ))}
      </div>
    </Card>
  );
}

function MoneyHead({ title, scope }: { title: string; scope: string }) {
  return (
    <div className="relative flex items-baseline justify-between gap-3">
      <h2 className="text-base leading-6 font-semibold">{title}</h2>
      <span className="text-xs text-accent-card-muted">{scope}</span>
    </div>
  );
}

function MoneyRow({
  label,
  first,
  several,
  children,
}: {
  label: string;
  first: boolean;
  several: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'py-3',
        !first && 'border-t border-accent-card-line',
        several ? 'flex flex-col gap-1.5' : 'flex items-center justify-between gap-4',
      )}
    >
      <span
        className={cn('font-medium', several ? 'text-[13px] text-accent-card-muted' : 'text-sm')}
      >
        {label}
      </span>
      <div
        className={cn(several ? 'grid grid-cols-1 gap-x-5 gap-y-2 md:grid-cols-2' : 'flex gap-5.5')}
      >
        {children}
      </div>
    </div>
  );
}
