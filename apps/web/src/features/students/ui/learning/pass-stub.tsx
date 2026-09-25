'use client';

import type { ReactNode } from 'react';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CirclePauseIcon,
  TriangleAlertIcon,
  WalletIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CoinsArt, PausedArt, ReceiptArt, TicketArt } from '@/components/shared/pass-art';
import { lastPauseDay } from '@/features/students/model/pause';
import type { PassState, PassView } from '@/features/students/model/learning';
import { cn } from '@/lib/utils';
import type { LearningFormat } from './use-learning-format';

/** Each stub state's tint, accent and art (S06 decision 2). */
const TONE: Record<
  PassState,
  { block: string; accent: string; value: string; art: string; fill: string; line: string }
> = {
  package: {
    block: 'bg-tint-indigo',
    accent: 'text-brand',
    value: 'text-foreground',
    art: 'text-brand',
    fill: 'bg-brand',
    line: 'border-brand',
  },
  empty: {
    block: 'bg-tint-indigo',
    accent: 'text-brand',
    value: 'text-foreground',
    art: 'text-brand opacity-50',
    fill: 'bg-brand',
    line: 'border-brand',
  },
  low: {
    block: 'bg-tint-warning',
    accent: 'text-tint-warning-foreground',
    value: 'text-foreground',
    art: 'text-tint-warning-foreground',
    fill: 'bg-tint-warning-foreground',
    line: 'border-tint-warning-foreground',
  },
  debt: {
    block: 'bg-tint-danger',
    accent: 'text-tint-danger-foreground',
    value: 'text-tint-danger-foreground',
    art: 'text-destructive',
    fill: 'bg-destructive',
    line: 'border-destructive',
  },
  advance: {
    block: 'bg-tint-success',
    accent: 'text-tint-success-foreground',
    value: 'text-tint-success-foreground',
    art: 'text-success',
    fill: 'bg-success',
    line: 'border-success',
  },
  clear: {
    block: 'bg-tint-success',
    accent: 'text-tint-success-foreground',
    value: 'text-foreground',
    art: 'text-success',
    fill: 'bg-success',
    line: 'border-success',
  },
  paused: {
    block: 'bg-secondary',
    accent: 'text-muted-foreground',
    value: 'text-muted-foreground',
    art: 'text-muted-foreground',
    fill: 'bg-muted-foreground',
    line: 'border-muted-foreground',
  },
};

const MAX_DOTS = 16;

/**
 * The left part of a direction's pass: what the direction has — credits,
 * money owed or ahead, or a pause — in its tint, with a small illustration.
 */
export function PassStub({
  view,
  format,
  openLabel,
  onOpen,
  className,
}: {
  view: PassView;
  format: LearningFormat;
  /** Names the stub as a button that opens the current package's ticket (S07). */
  openLabel?: string;
  onOpen?: () => void;
  className?: string;
}) {
  const t = useTranslations('students.learningBlock.stub');
  const { direction, state, credits, pause } = view;
  const tone = TONE[state];
  const currency = direction.currency;
  const packageMode = direction.billingType === 'PACKAGE';
  // A paused direction keeps its money owed in red (decision 10).
  const valueTone = view.owesWhilePaused ? TONE.debt.value : tone.value;
  const until = pause?.endsAt ? format.shortDay(lastPauseDay(pause.endsAt)) : null;
  const unpaidDates = direction.balance.unpaid.map((lesson) => lesson.startsAt);

  const label =
    state === 'paused'
      ? until
        ? t('pausedUntil', { date: until })
        : t('paused')
      : t(`label.${state === 'empty' ? 'package' : state}`);
  const icon: ReactNode =
    state === 'paused' ? (
      <CirclePauseIcon />
    ) : state === 'low' ? (
      <TriangleAlertIcon />
    ) : state === 'debt' ? (
      <CircleAlertIcon />
    ) : state === 'advance' || state === 'clear' ? (
      <WalletIcon />
    ) : (
      <CircleCheckIcon />
    );

  const showsCredits = packageMode && credits && !(state === 'paused' && view.owesWhilePaused);
  const money = (amountMinor: number) => {
    const parts = format.moneyParts(Math.abs(amountMinor), currency);
    const sign = amountMinor < 0 ? '−' : amountMinor > 0 ? '+' : '';
    return (
      <>
        <span className="text-[40px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap">
          {`${sign}${parts.value}`}
        </span>
        <span className="text-lg font-semibold text-tint-foreground">{parts.symbol}</span>
      </>
    );
  };

  const value = showsCredits ? (
    <>
      <span className="text-[40px] leading-none font-bold tracking-[-0.02em]">{credits.left}</span>
      <span className="text-lg font-semibold text-tint-foreground">
        {t('of', { total: credits.total })}
      </span>
    </>
  ) : packageMode && state === 'debt' ? (
    <>
      <span className="text-[40px] leading-none font-bold tracking-[-0.02em]">
        {view.debtLessons}
      </span>
      <span className="text-lg font-semibold text-tint-foreground">
        {t('lessonsOnDebt', { count: view.debtLessons })}
      </span>
    </>
  ) : packageMode && !credits ? (
    <span className="text-[40px] leading-none font-bold tracking-[-0.02em]">0</span>
  ) : (
    money(view.balanceMinor)
  );

  const caption =
    state === 'paused'
      ? view.owesWhilePaused
        ? until
          ? t('debtStaysUntil', { date: until })
          : t('debtStays')
        : packageMode && view.current?.expiresAt
          ? t('extendedTo', {
              date: format.shortDay(new Date(Date.parse(view.current.expiresAt) - 1)),
            })
          : until
            ? t('backAfter', { date: until })
            : t('backByHand')
      : showsCredits
        ? view.current?.expiresAt
          ? t('usedUntil', {
              used: credits.used,
              date: format.shortDay(new Date(Date.parse(view.current.expiresAt) - 1)),
            })
          : t('used', { used: credits.used })
        : state === 'debt'
          ? packageMode
            ? t('nextPackageCovers')
            : unpaidDates.length > 0 && unpaidDates.length <= 2
              ? t('unpaidOn', { count: unpaidDates.length, dates: format.dateList(unpaidDates) })
              : t('unpaid', { count: direction.balance.unpaidLessons })
          : state === 'advance'
            ? t('enoughFor', { count: view.advanceLessons })
            : state === 'clear'
              ? t('clear')
              : t('noPackage');

  const art =
    state === 'paused' ? (
      <PausedArt />
    ) : state === 'debt' ? (
      <ReceiptArt />
    ) : state === 'advance' || state === 'clear' ? (
      <CoinsArt />
    ) : (
      <TicketArt />
    );

  return (
    <div
      data-slot="pass-stub"
      data-state={state}
      className={cn(
        'relative flex flex-col justify-center gap-2 overflow-hidden px-5.5 py-4.5',
        tone.block,
        className,
      )}
    >
      <div className={cn('pointer-events-none absolute top-3.5 right-3.5 opacity-90', tone.art)}>
        {art}
      </div>
      <div
        className={cn(
          'relative flex items-center gap-1.5 pr-14 text-xs font-bold tracking-[0.06em] uppercase [&_svg]:size-3.5',
          tone.accent,
        )}
      >
        {icon}
        {label}
      </div>
      <div className={cn('relative flex items-baseline gap-1.5', valueTone)}>{value}</div>
      {showsCredits && credits.total <= MAX_DOTS ? (
        <div className="relative flex flex-wrap gap-1.5" aria-hidden="true">
          {Array.from({ length: credits.total }, (_, index) => (
            <span
              key={index}
              className={cn(
                'size-4 rounded-pill',
                index < credits.left
                  ? tone.fill
                  : cn('border-[1.5px] border-dashed opacity-55', tone.line),
              )}
            />
          ))}
        </div>
      ) : null}
      <span className="relative text-xs text-tint-foreground">{caption}</span>
      {onOpen ? (
        <button
          type="button"
          aria-label={openLabel}
          onClick={onOpen}
          className="absolute inset-0 outline-none hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
        />
      ) : null}
    </div>
  );
}
