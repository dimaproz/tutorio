'use client';

import { useState } from 'react';
import { BanknoteIcon, CircleCheckIcon, InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PackageResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { lastDayOf } from '../../model/dates';
import { owedMinor } from '../../model/ticket';
import { CreditDots } from '../credit-dots';
import { PackagePaymentDialog } from '../operations/payment-dialog';
import { usePackageFormat } from '../use-package-format';
import { usePackageTitle } from '../use-package-title';

/**
 * «Продано N пакетів» (S08 board 02, state 04): the summary band — how many,
 * the size, the window, the price and the sum, with «Оплату ще не записано»
 * (L-87) — and one row per member: their credits (the lessons on debt the
 * package closed already drawn, L-82), the price and «Записати оплату»,
 * each member paying separately (L-86). A bottom sheet on phones.
 */
export function MembersSoldDialog({
  packages,
  groupName,
  avatars,
  mobile,
  onClose,
}: {
  packages: PackageResponse[];
  groupName: string;
  /** The members' avatars, which a package read does not carry. */
  avatars: ReadonlyMap<string, string | null>;
  mobile: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('packages.membersSold');
  const tSale = useTranslations('packages.memberSale');
  const tSold = useTranslations('packages.sold');
  const format = usePackageFormat();
  const titleOf = usePackageTitle();
  const [paying, setPaying] = useState<PackageResponse | null>(null);
  // A payment recorded from here takes the member's button away.
  const [paid, setPaid] = useState<ReadonlySet<string>>(new Set());
  const first = packages[0];
  if (!first) return null;
  const currency = first.currency;
  const total = packages.reduce((sum, pkg) => sum + pkg.totalPriceMinorSnapshot, 0);
  const sizes = new Set(packages.map((pkg) => pkg.lessonsTotal));
  const window =
    first.sizingMode !== 'FIXED_COUNT' && first.validFrom && first.expiresAt
      ? format.dayRange(first.validFrom, lastDayOf(first.expiresAt))
      : first.expiresAt
        ? tSold('until', { date: format.dayMonth(lastDayOf(first.expiresAt)) })
        : tSold('noEnd');

  return (
    <>
      <AdaptiveDialog
        open={paying === null}
        onOpenChange={(open) => (open ? undefined : onClose())}
        closeLabel={t('close')}
        size="2xl"
        icon={<CircleCheckIcon />}
        iconClassName="bg-tint-success text-tint-success-foreground"
        title={t('title', { count: packages.length })}
        description={groupName}
        tertiary={
          mobile ? undefined : (
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground [&_svg]:size-4">
              <InfoIcon />
              {t('footer')}
            </span>
          )
        }
        primary={
          <Button type="button" onClick={onClose}>
            {t('done')}
          </Button>
        }
      >
        <div className="flex flex-col gap-3 rounded-row bg-tint-indigo p-5 text-tint-foreground md:flex-row md:items-center md:gap-4">
          <span className="flex min-w-0 grow items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-item bg-card text-brand [&_svg]:size-6"
            >
              <CircleCheckIcon />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-lg leading-6 font-semibold tracking-[-0.01em]">
                {t('summary', {
                  packages: tSale('packages', { count: packages.length }),
                  each:
                    sizes.size === 1
                      ? tSale('each', { count: first.lessonsTotal })
                      : tSale('result', { count: first.lessonsTotal }),
                })}
              </span>
              <span className="text-sm leading-5">
                {t('window', {
                  window,
                  price: format.money(first.pricePerLessonMinorSnapshot, currency),
                  total: format.money(total, currency),
                })}
              </span>
            </span>
          </span>
          {packages.every((pkg) => owedMinor(pkg) > 0) ? (
            <Badge variant="warning" className="self-start md:self-center">
              {t('notPaid')}
            </Badge>
          ) : null}
        </div>

        <section aria-label={t('heading')} className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
            {t('heading')}
          </span>
          <ul className="flex flex-col gap-2">
            {packages.map((pkg) => {
              const left = Math.max(pkg.remainingCredits, 0);
              // Credits spent at the sale are the lessons on debt it closed (L-82).
              const closed = pkg.consumedCredits;
              return (
                <li
                  key={pkg.id}
                  className={
                    mobile
                      ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-3 rounded-row bg-background px-4 py-3.5'
                      : 'flex items-center gap-3.5 rounded-row bg-background px-4 py-3.5'
                  }
                >
                  <EntityAvatar
                    avatarKey={avatars.get(pkg.studentId) ?? null}
                    fullName={pkg.student.fullName}
                    size="md"
                  />
                  <span className="flex min-w-0 grow flex-col gap-1.5">
                    <span className="truncate text-[15px] leading-5 font-semibold">
                      {pkg.student.fullName}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <CreditDots left={left} total={pkg.lessonsTotal} size="xs" tone="brand" />
                      <span className="text-[13px] leading-[18px] text-muted-foreground">
                        {closed > 0
                          ? t('covered', { left, total: pkg.lessonsTotal, count: closed })
                          : t('left', { left, total: pkg.lessonsTotal })}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold whitespace-nowrap tabular-nums">
                    {format.money(pkg.totalPriceMinorSnapshot, currency)}
                  </span>
                  {owedMinor(pkg) === 0 || paid.has(pkg.id) ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className={mobile ? 'col-span-3 h-10 w-full' : 'shrink-0'}
                      aria-label={t('payFor', { name: pkg.student.fullName })}
                      onClick={() => setPaying(pkg)}
                    >
                      <BanknoteIcon data-icon="inline-start" />
                      {t('pay')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </AdaptiveDialog>

      {paying ? (
        <PackagePaymentDialog
          pkg={paying}
          title={titleOf(paying)}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaid((current) => new Set([...current, paying.id]));
            setPaying(null);
          }}
        />
      ) : null}
    </>
  );
}
