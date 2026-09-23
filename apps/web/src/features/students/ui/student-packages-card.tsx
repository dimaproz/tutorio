'use client';

import Link from 'next/link';
import { PackagePlusIcon, WalletCardsIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PackagePaymentStatusBadge } from '@/components/packages/package-status';
import { PackageFormDialog } from '@/components/packages/package-form-dialog';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { SectionTitle } from '@/components/shared/detail-view';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { usePackagesQuery } from '@/lib/api/packages';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentPackagesCard({
  studentId,
  createOpen,
  onCreateOpenChange,
  readOnly = false,
  bare = false,
}: {
  studentId: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  /**
   * Renders only the body, for use inside the profile's section card. The
   * caller also owns the create dialog: a tab panel unmounts when its segment
   * is not selected, which would take the dialog with it.
   */
  bare?: boolean;
}) {
  const t = useTranslations('students.packages');
  const locale = useLocale();
  const packages = usePackagesQuery({
    page: 1,
    pageSize: 100,
    studentId,
    state: readOnly ? 'all' : 'active',
  });
  const body = (
    <>
      {packages.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : packages.isError ? (
        <QueryErrorAlert title={t('error')} onRetry={() => void packages.refetch()} />
      ) : packages.data.items.length === 0 ? (
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
          {packages.data.items.map((item) => (
            <li key={item.id}>
              <Item asChild variant="outline">
                <Link href={`/app/packages/${item.id}`}>
                  <ItemContent>
                    <ItemTitle>{item.name ?? t('unnamed')}</ItemTitle>
                    <ItemDescription>
                      {t('balance', { remaining: item.remainingCredits, total: item.lessonsTotal })}{' '}
                      · {formatMoneyDisplay(item.paidMinor, item.currency, locale)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <PackagePaymentStatusBadge status={item.paymentStatus} />
                  </ItemActions>
                </Link>
              </Item>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const dialog = !readOnly ? (
    <PackageFormDialog
      open={createOpen}
      onOpenChange={onCreateOpenChange}
      lockedStudentId={studentId}
    />
  ) : null;

  // In `bare` mode the profile's section card owns the add action, so the panel
  // never shows a second button for the same job.
  if (bare) {
    return <div className="flex flex-col gap-2">{body}</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <SectionTitle icon={WalletCardsIcon}>{t('title')}</SectionTitle>
          {!readOnly ? (
            <CardAction>
              <Button type="button" size="sm" onClick={() => onCreateOpenChange(true)}>
                <PackagePlusIcon data-icon="inline-start" />
                {t('add')}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
      {dialog}
    </>
  );
}
