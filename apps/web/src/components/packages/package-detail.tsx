'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BanknoteIcon,
  HistoryIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UsersRoundIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BackButton } from '@/components/app/back-button';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionTitle } from '@/components/app/detail-view';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import {
  PackagePaymentStatusBadge,
  PaymentStatusBadge,
} from '@/components/app/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDeletePackageMutation,
  usePackageLedgerQuery,
  usePackageQuery,
  usePaymentsQuery,
} from '@/lib/api/packages';
import { formatMoneyDisplay } from '@/lib/money';
import { useDateFormatters } from '@/lib/i18n/format';
import { AdjustBalanceDialog } from './adjust-balance-dialog';
import { PaymentDialog, type PaymentTarget } from './payment-dialog';

export function PackageDetailView({ packageId }: { packageId: string }) {
  const t = useTranslations('packages');
  const tDetail = useTranslations('packages.detail');
  const tCard = useTranslations('packages.card');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const format = useDateFormatters();
  const router = useRouter();
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pkg = usePackageQuery(packageId);
  const ledger = usePackageLedgerQuery(packageId);
  const payments = usePaymentsQuery({ page: 1, pageSize: 50, packageId });
  const deletePackage = useDeletePackageMutation();

  if (pkg.isPending) {
    return <ListSkeleton rows={5} />;
  }
  if (pkg.isError) {
    return (
      <QueryErrorAlert
        error={pkg.error}
        title={t('title')}
        onRetry={() => void pkg.refetch()}
      />
    );
  }

  const data = pkg.data;
  const owner = data.student?.fullName ?? data.group?.name ?? '—';
  const isGroup = Boolean(data.groupId);
  const remainingRatio =
    data.lessonsTotal > 0
      ? Math.min(100, Math.max(0, (data.remainingCredits / data.lessonsTotal) * 100))
      : 0;
  // A snapshot that no longer matches reality is shown struck through.
  const adjustedDown = data.effectiveTotalMinor < data.totalPriceMinorSnapshot;


  const openPaymentFor = (
    enrollmentId: string,
    fullName: string,
    oweMinor?: number,
  ) => {
    setPaymentTarget({ enrollmentId, fullName, oweMinor });
    setPaymentOpen(true);
  };

  async function onDelete() {
    try {
      await deletePackage.mutateAsync(packageId);
      toast.success(t('toasts.deleted'));
      router.push('/app/finance');
    } catch {
      // Surfaced by the mutation error state.
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <BackButton href="/app/finance" />
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Button variant="outline" onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontalIcon data-icon="inline-start" />
              {tDetail('adjust')}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon data-icon="inline-start" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{owner}</h1>
          <PackagePaymentStatusBadge status={data.paymentStatus} />
        </div>
        {data.name ? (
          <p className="text-muted-foreground text-sm">{data.name}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <SectionTitle icon={BanknoteIcon} tone="success">
                {tCard('remaining')}
              </SectionTitle>
              {!isGroup ? (
                <CardAction>
                  <Button
                    size="sm"
                    onClick={() =>
                      openPaymentFor(
                        // An individual package books money against the single
                        // enrollment behind its purchase entry.
                        ledger.data?.items.find((entry) => entry.enrollmentId)
                          ?.enrollmentId ?? '',
                        owner,
                        Math.max(0, data.effectiveTotalMinor - data.paidMinor),
                      )
                    }
                  >
                    {tDetail('recordPayment')}
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="tabular text-3xl font-semibold">
                    {data.remainingCredits}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {tCard('of', { total: data.lessonsTotal })}
                  </span>
                </div>
                <Progress value={remainingRatio} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {tCard('effectiveTotal')}
                  </span>
                  <span className="tabular flex items-baseline gap-2 text-sm font-semibold">
                    {formatMoneyDisplay(data.effectiveTotalMinor, data.currency, locale)}
                    {adjustedDown ? (
                      <s className="text-muted-foreground font-normal">
                        {formatMoneyDisplay(
                          data.totalPriceMinorSnapshot,
                          data.currency,
                          locale,
                        )}
                      </s>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {tCard('paid')}
                  </span>
                  <span className="tabular text-sm font-semibold">
                    {formatMoneyDisplay(data.paidMinor, data.currency, locale)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isGroup ? (
            <Card>
              <CardHeader>
                <SectionTitle icon={UsersRoundIcon} tone="warning">
                  {tDetail('sharesTitle')}
                </SectionTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {data.shares.map((share) => (
                    <li
                      key={share.id}
                      className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{share.student.fullName}</span>
                          <PackagePaymentStatusBadge status={share.paymentStatus} />
                        </div>
                        <span className="tabular text-muted-foreground text-sm">
                          {formatMoneyDisplay(share.paidMinor, data.currency, locale)}
                          {' / '}
                          {formatMoneyDisplay(share.oweMinor, data.currency, locale)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openPaymentFor(
                            share.enrollmentId,
                            share.student.fullName,
                            Math.max(0, share.oweMinor - share.paidMinor),
                          )
                        }
                      >
                        {tDetail('recordPayment')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {/* The whole point of the ledger: the balance explains itself. */}
          <Card>
            <CardHeader>
              <SectionTitle icon={HistoryIcon} tone="primary">
                {tDetail('historyTitle')}
              </SectionTitle>
              <p className="text-muted-foreground text-sm">
                {tDetail('historySubtitle')}
              </p>
            </CardHeader>
            <CardContent>
              {ledger.isPending ? (
                <div className="flex flex-col gap-3" aria-busy="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-2/3" />
                </div>
              ) : ledger.data && ledger.data.items.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {ledger.data.items.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <Badge
                        variant={
                          entry.delta > 0
                            ? 'success'
                            : entry.delta < 0
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="tabular shrink-0"
                      >
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </Badge>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">
                          {t(`entryType.${entry.type}`)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {format.dayMonthTime(entry.createdAt)}
                        </span>
                        {entry.note ? (
                          <span className="text-muted-foreground text-xs">
                            {entry.note}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">{tDetail('noEntries')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={BanknoteIcon} tone="success">
                {tDetail('paymentsTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {payments.isPending ? (
                <div className="flex flex-col gap-3" aria-busy="true">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              ) : payments.data && payments.data.items.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {payments.data.items.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="tabular text-sm font-medium">
                          {formatMoneyDisplay(
                            payment.amountMinor,
                            payment.currency,
                            locale,
                          )}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {t(`method.${payment.method}`)} ·{' '}
                          {format.dayMonthTime(payment.paidAt)}
                        </span>
                      </div>
                      <PaymentStatusBadge status={payment.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">{tDetail('noPayments')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        packageId={data.id}
        currency={data.currency}
        target={paymentTarget}
      />
      <AdjustBalanceDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        packageId={data.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deletePackage.isPending}
      />
    </>
  );
}
