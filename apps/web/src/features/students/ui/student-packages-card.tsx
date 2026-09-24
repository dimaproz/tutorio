'use client';

import { useMemo } from 'react';
import { WalletCardsIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { SectionTitle } from '@/components/shared/detail-view';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { PackagePaymentStatusBadge } from './package-status';
import {
  studentPackagesFilters,
  visibleStudentPackages,
} from '@/features/students/model/student-packages';
import { usePackagesQuery } from '@/lib/api/packages';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentPackagesCard({
  studentId,
  readOnly = false,
  bare = false,
}: {
  studentId: string;
  readOnly?: boolean;
  /** Renders only the body, for use inside the profile's section card. */
  bare?: boolean;
}) {
  const t = useTranslations('students.packages');
  const locale = useLocale();
  // The profile's one package read; an archived (read-only) profile keeps the
  // deleted packages of its history, a live one shows live packages only.
  const packages = usePackagesQuery(studentPackagesFilters(studentId));
  const items = useMemo(
    () => visibleStudentPackages(packages.data?.items ?? [], readOnly),
    [packages.data, readOnly],
  );
  const body = (
    <>
      {packages.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : packages.isError ? (
        <QueryErrorAlert title={t('error')} onRetry={() => void packages.refetch()} />
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('empty')}</EmptyTitle>
            <EmptyDescription>
              {readOnly ? t('emptyArchived') : t('emptyDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>{item.name ?? t('unnamed')}</ItemTitle>
                  <ItemDescription>
                    {t('balance', { remaining: item.remainingCredits, total: item.lessonsTotal })} ·{' '}
                    {formatMoneyDisplay(item.paidMinor, item.currency, locale)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <PackagePaymentStatusBadge status={item.paymentStatus} />
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (bare) {
    return <div className="flex flex-col gap-2">{body}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={WalletCardsIcon}>{t('title')}</SectionTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
