'use client';

import { useTranslations } from 'next-intl';
import type { PackageResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { memberPackagesPaid } from '@/features/groups/model/presentation';
import { cn } from '@/lib/utils';

const PAYMENT_BADGE = { PAID: 'success', PENDING: 'warning', PARTIAL: 'warning' } as const;
const PAYMENT_LABEL = { PAID: 'paid', PENDING: 'pending', PARTIAL: 'partial' } as const;

/**
 * The members' packages for this group: every member pays with their own
 * package (ADR 0007), so each row is one member, the lessons left on their
 * package and whether it is paid. Selling a package to members is its own
 * flow; a member without a package pays each lesson from their balance.
 */
export function GroupPackageCard({
  packages,
  loading,
  compact,
}: {
  /** One package per member: `memberPackages`. */
  packages: readonly PackageResponse[];
  loading: boolean;
  /** Phones show one line instead of the rows. */
  compact: boolean;
}) {
  const t = useTranslations('groups.package');
  const header = <h2 className="min-h-8 text-base leading-8 font-semibold">{t('title')}</h2>;

  if (loading) {
    return (
      <Card className="gap-3 px-6 py-5.5">
        {header}
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card className="gap-3 px-6 py-5.5">
        {header}
        <p className="text-sm leading-5 text-muted-foreground">{t('emptyText')}</p>
      </Card>
    );
  }

  const { paid, total } = memberPackagesPaid(packages);
  return (
    <Card className="gap-3 px-6 py-5.5">
      {header}
      {compact ? (
        <span
          className={cn(
            'text-[13px]',
            paid < total ? 'text-tint-warning-foreground' : 'text-muted-foreground',
          )}
        >
          {t('paidCount', { paid, total })}
        </span>
      ) : (
        <ul className="flex flex-col gap-1">
          {packages.map((pkg) => (
            <li key={pkg.id} className="flex min-h-9 items-center gap-2.5">
              <EntityAvatar
                avatarKey={null}
                fullName={pkg.student.fullName}
                size="xs"
                tint="indigo"
              />
              <span className="min-w-0 grow truncate text-sm">{pkg.student.fullName}</span>
              <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                {t('lessonsLeft', { left: pkg.remainingCredits, total: pkg.lessonsTotal })}
              </span>
              <Badge variant={PAYMENT_BADGE[pkg.paymentStatus]}>
                {t(PAYMENT_LABEL[pkg.paymentStatus])}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
