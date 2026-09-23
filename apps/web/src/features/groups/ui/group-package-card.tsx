'use client';

import Link from 'next/link';
import { EllipsisVerticalIcon, ExternalLinkIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { PackageResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { SectionDivider } from '@/components/shared/section-divider';
import { formatMoneyCompact } from '@/lib/money';

const SHARE_BADGE = { PAID: 'success', PENDING: 'warning', PARTIAL: 'warning' } as const;
const SHARE_LABEL = { PAID: 'paid', PENDING: 'pending', PARTIAL: 'partial' } as const;

/**
 * The group's package: lessons left of the total, its name, end date and
 * price, the credit meter, and each member's share with its payment state.
 * Package sale itself is its own flow; this card only shows the live one
 * and offers to create one when there is none.
 */
export function GroupPackageCard({
  pkg,
  loading,
  compact,
  readOnly,
  onCreate,
}: {
  pkg: PackageResponse | null;
  loading: boolean;
  /** Phones show one line for the shares instead of the rows. */
  compact: boolean;
  readOnly: boolean;
  onCreate: () => void;
}) {
  const t = useTranslations('groups.package');
  const locale = useLocale();
  const format = useFormatter();

  const header = (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{t('title')}</h2>
      {pkg ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="paper" size="icon-sm" aria-label={t('menu')}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={`/app/packages/${pkg.id}`}>
                <ExternalLinkIcon data-icon />
                {t('open')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <Card className="gap-3 px-6 py-5.5">
        {header}
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3 w-full" />
      </Card>
    );
  }

  if (!pkg) {
    return (
      <Card className="gap-3 px-6 py-5.5">
        {header}
        <p className="text-sm leading-5 text-muted-foreground">{t('emptyText')}</p>
        {readOnly ? null : (
          <Button type="button" variant="outline" size="xs" className="self-start max-md:h-11" onClick={onCreate}>
            <PlusIcon data-icon="inline-start" />
            {t('create')}
          </Button>
        )}
      </Card>
    );
  }

  const paid = pkg.shares.filter((share) => share.paymentStatus === 'PAID').length;
  const meta = [
    pkg.name ? `«${pkg.name}»` : null,
    pkg.expiresAt
      ? t('until', { date: format.dateTime(new Date(pkg.expiresAt), { day: 'numeric', month: 'short' }) })
      : null,
    t('perLesson', {
      price: formatMoneyCompact(pkg.pricePerLessonMinorSnapshot, pkg.currency, locale).text,
    }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="gap-3 px-6 py-5.5">
      {header}
      <div className="flex flex-col gap-1">
        <span className="text-xl leading-7 font-semibold tracking-[-0.01em]">
          {t('lessonsLeft', { left: pkg.remainingCredits, total: pkg.lessonsTotal })}
        </span>
        <span className="text-[13px] text-muted-foreground">{meta}</span>
      </div>
      <CreditMeter
        size="lg"
        left={pkg.remainingCredits}
        total={pkg.lessonsTotal}
        usedLabel={t('used', { count: pkg.consumedCredits })}
        leftLabel={t('left', { count: pkg.remainingCredits })}
      />
      {pkg.shares.length > 0 ? (
        compact ? (
          <span className="text-[13px] text-tint-warning-foreground">
            {t('sharesShort', { paid, total: pkg.shares.length })}
          </span>
        ) : (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <SectionDivider label={t('shares', { paid, total: pkg.shares.length })} />
            <ul className="flex flex-col gap-1">
              {pkg.shares.map((share) => (
                <li key={share.id} className="flex min-h-9 items-center gap-2.5">
                  <EntityAvatar
                    avatarKey={share.student.avatarKey}
                    fullName={share.student.fullName}
                    size="xs"
                    tint="indigo"
                  />
                  <span className="min-w-0 grow truncate text-sm">{share.student.fullName}</span>
                  <Badge variant={SHARE_BADGE[share.paymentStatus]}>
                    {t(SHARE_LABEL[share.paymentStatus])}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </Card>
  );
}
