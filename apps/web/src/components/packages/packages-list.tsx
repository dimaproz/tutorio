'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusIcon, WalletIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { PackageResponse } from '@tutorio/validation';
import { PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { PackagePaymentStatusBadge } from '@/components/app/status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { LoadingPanel } from '@/components/shared';
import { usePackagesQuery } from '@/lib/api/packages';
import { formatMoneyDisplay } from '@/lib/money';
import { PackageFormDialog } from './package-form-dialog';

/**
 * One package as a card: who it is for, how many lessons are left, and whether
 * the money arrived. The lessons-left ring is the number a tutor scans for.
 */
function PackageCard({ item }: { item: PackageResponse }) {
  const t = useTranslations('packages.card');
  const locale = useLocale();

  const owner = item.student?.fullName ?? item.group?.name ?? '—';
  const consumedRatio =
    item.lessonsTotal > 0
      ? Math.min(100, Math.max(0, (item.remainingCredits / item.lessonsTotal) * 100))
      : 0;

  return (
    <Link href={`/app/packages/${item.id}`} className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{owner}</span>
              {item.name ? (
                <span className="text-muted-foreground truncate text-sm">{item.name}</span>
              ) : null}
            </div>
            <PackagePaymentStatusBadge status={item.paymentStatus} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-sm">{t('remaining')}</span>
              <span className="tabular text-sm font-semibold">
                {item.remainingCredits} {t('of', { total: item.lessonsTotal })}
              </span>
            </div>
            <Progress value={consumedRatio} />
          </div>

          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="tabular font-medium">
              {formatMoneyDisplay(item.effectiveTotalMinor, item.currency, locale)}
            </span>
            <span className="text-muted-foreground tabular">
              {t('paid')}: {formatMoneyDisplay(item.paidMinor, item.currency, locale)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function PackagesList() {
  const t = useTranslations('packages');
  const [formOpen, setFormOpen] = useState(false);
  const packages = usePackagesQuery({ page: 1, pageSize: 50 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button onClick={() => setFormOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t('add')}
          </Button>
        }
      />

      {packages.isPending ? (
        <LoadingPanel size="lg" className="min-h-72" />
      ) : packages.isError ? (
        <QueryErrorAlert
          error={packages.error}
          title={t('title')}
          onRetry={() => void packages.refetch()}
        />
      ) : packages.data.items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletIcon />
            </EmptyMedia>
            <EmptyTitle>{t('empty')}</EmptyTitle>
            <EmptyDescription>{t('emptyHint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setFormOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t('add')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packages.data.items.map((item) => (
            <PackageCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <PackageFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
