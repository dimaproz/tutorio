'use client';

import { useTranslations } from 'next-intl';
import type { PackageResponse } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { cn } from '@/lib/utils';
import { lastDayOf } from '../../model/dates';
import { rowCredits } from '../../model/list';
import { directionName } from '../../model/names';
import { owedMinor } from '../../model/ticket';
import { CreditDots } from '../credit-dots';
import type { PackageFormat } from '../use-package-format';

export type ListPackage = PackageResponse;

/** «English · Dmytro Tutor», or «B1 English · група». */
export function useDirectionLine() {
  const t = useTranslations('packages.list');
  return (pkg: ListPackage) =>
    pkg.group
      ? t('groupLine', { name: pkg.group.name })
      : t('individualLine', { name: directionName(pkg), teacher: pkg.teacher.name });
}

/** The student and the direction; the name opens the ticket. */
export function WhoCell({ pkg, onOpen }: { pkg: ListPackage; onOpen: () => void }) {
  const line = useDirectionLine();
  const t = useTranslations('packages.list');
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <EntityAvatar avatarKey={pkg.student.avatarKey} fullName={pkg.student.fullName} size="md" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t('open', { name: pkg.student.fullName })}
          className="truncate text-left text-[15px] leading-5 font-semibold outline-none hover:underline focus-visible:underline"
        >
          {pkg.student.fullName}
        </button>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {line(pkg)}
        </span>
      </div>
    </div>
  );
}

/** «Кількість», «Період» or «3 на тиждень». */
export function KindCell({ pkg }: { pkg: ListPackage }) {
  const t = useTranslations('packages.kinds');
  return (
    <span className="text-sm text-muted-foreground">
      {pkg.sizingMode === 'BY_PERIOD_WEEKLY' && pkg.lessonsPerWeek
        ? t('weekly', { count: pkg.lessonsPerWeek })
        : t(pkg.sizingMode)}
    </span>
  );
}

const FIGURE_TONE = {
  brand: 'text-foreground',
  warning: 'text-tint-warning-foreground',
  danger: 'text-destructive',
} as const;

/** The credits as dots (bars for a small package) and «6 з 8», coloured when running out. */
export function CreditsCell({
  pkg,
  now,
  threshold,
}: {
  pkg: ListPackage;
  now: Date;
  threshold: number;
}) {
  const t = useTranslations('packages.list');
  const credits = rowCredits(pkg, now, threshold);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <CreditDots
        left={credits.left}
        total={credits.total}
        tone={credits.tone}
        size="xs"
        used="quiet"
        bars={credits.bars}
        className="min-w-0 flex-nowrap overflow-hidden"
      />
      <span
        className={cn(
          'shrink-0 text-sm font-bold whitespace-nowrap tabular-nums',
          FIGURE_TONE[credits.tone],
        )}
      >
        {t('creditsOf', { left: credits.left, total: pkg.lessonsTotal })}
      </span>
    </span>
  );
}

/** «до 30 жовт», «1–31 жовт» or «безстроково»; warning when it closes within the week. */
export function WindowCell({
  pkg,
  now,
  threshold,
  format,
}: {
  pkg: ListPackage;
  now: Date;
  threshold: number;
  format: PackageFormat;
}) {
  const t = useTranslations('packages.list');
  const closing = rowCredits(pkg, now, threshold).windowClosing;
  const text = !pkg.expiresAt
    ? t('noEnd')
    : pkg.sizingMode !== 'FIXED_COUNT' && pkg.validFrom
      ? format.shortRange(pkg.validFrom, lastDayOf(pkg.expiresAt))
      : t('until', { date: format.shortDay(lastDayOf(pkg.expiresAt)) });
  return (
    <span
      className={cn(
        'text-sm whitespace-nowrap',
        closing ? 'font-bold text-tint-warning-foreground' : 'text-foreground',
      )}
    >
      {text}
    </span>
  );
}

/** «Оплачено», «2 000 з 3 600 ₴» or «Не оплачено», with a coloured dot. */
export function PaymentCell({ pkg, format }: { pkg: ListPackage; format: PackageFormat }) {
  const t = useTranslations('packages.list');
  const owed = owedMinor(pkg);
  const tone =
    owed === 0
      ? 'text-tint-success-foreground'
      : pkg.paidMinor > 0
        ? 'font-bold text-tint-warning-foreground'
        : 'font-bold text-destructive';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm whitespace-nowrap', tone)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-current" />
      {owed === 0
        ? t('paid')
        : pkg.paidMinor > 0
          ? t('paidOf', {
              paid: format.money(pkg.paidMinor, pkg.currency),
              total: format.money(pkg.totalPriceMinorSnapshot, pkg.currency),
            })
          : t('unpaid')}
    </span>
  );
}

/** The package's price in its own currency. */
export function PriceCell({ pkg, format }: { pkg: ListPackage; format: PackageFormat }) {
  return (
    <span className="block text-right text-[15px] font-bold whitespace-nowrap tabular-nums">
      {format.money(pkg.totalPriceMinorSnapshot, pkg.currency)}
    </span>
  );
}
