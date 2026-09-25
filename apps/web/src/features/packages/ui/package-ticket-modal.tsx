'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  PackageIcon,
  RotateCcwIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import type { PackageDetailResponse, PaymentResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { DrawerTitle } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { IconButton } from '@/components/shared/icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePackageDetailQuery, usePackageLedgerQuery, usePackagePaymentsQuery } from '../api';
import { directionName, packageLine } from '../model/names';
import {
  creditDots,
  paymentsIn,
  ticketActions,
  ticketHistory,
  ticketLessons,
  ticketState,
  type TicketState,
} from '../model/ticket';
import { AdjustDialog } from './operations/adjust-dialog';
import { DeleteDialog } from './operations/delete-dialog';
import { ExtendDialog } from './operations/extend-dialog';
import { PackagePaymentDialog } from './operations/payment-dialog';
import { RefundDialog } from './operations/refund-dialog';
import { TransferDialog } from './operations/transfer-dialog';
import { PackageSaleDialog } from './sale/package-sale-dialog';
import { PackageTicket } from './package-ticket';
import { TicketActions, type TicketOperation } from './ticket-actions';
import { TicketActivity } from './ticket-activity';
import { TicketMetrics } from './ticket-metrics';
import { TicketWindow } from './ticket-window';
import { usePackageFormat } from './use-package-format';
import { usePackageTitle } from './use-package-title';

const STATE_ICON: Record<TicketState, typeof PackageIcon> = {
  new: SparklesIcon,
  active: PackageIcon,
  used: CheckCheckIcon,
  expired: CalendarClockIcon,
};

/**
 * The package ticket modal (S07 board 02, decision 4): the package as a
 * vertical ticket — a modal on desktop, a bottom sheet on phones — with its
 * actions, «Діє до» and «Сплачено», the callout of its state, and its
 * lessons and history. Every operation opens over it and returns to it with
 * the new values (decision 6). `packageId` null closes it.
 */
export function PackageTicketModal({
  packageId,
  onClose,
  studentHref,
  nowMs,
}: {
  packageId: string | null;
  onClose: () => void;
  /** Where «Відкрити учня» goes; omitted on the student's own profile. */
  studentHref?: (studentId: string) => string;
  nowMs?: number;
}) {
  const t = useTranslations('packages.ticket');
  const mobile = useIsMobile();
  const detail = usePackageDetailQuery(packageId);
  const Title = mobile ? DrawerTitle : DialogTitle;

  let content;
  if (detail.data) {
    content = (
      <TicketContent
        pkg={detail.data}
        mobile={mobile}
        onClose={onClose}
        studentHref={studentHref}
        nowMs={nowMs}
      />
    );
  } else if (detail.isError) {
    content = (
      <div className="flex flex-col gap-4 bg-card p-6">
        <Title className="sr-only">{t('errorTitle')}</Title>
        <EmptyState
          framed={false}
          minHeight={220}
          icon={<AlertCircleIcon />}
          title={t('errorTitle')}
          text={t('errorText')}
          action={
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('close')}
              </Button>
              <Button type="button" onClick={() => void detail.refetch()}>
                <RotateCcwIcon data-icon="inline-start" />
                {t('retry')}
              </Button>
            </div>
          }
        />
      </div>
    );
  } else {
    content = (
      <div role="status" aria-busy="true" className="flex flex-col bg-card">
        <Title className="sr-only">{t('loading')}</Title>
        <Skeleton className="h-62.5 w-full rounded-none" />
        <div className="flex flex-col gap-4 p-6">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40 rounded-pill" />
            <Skeleton className="h-9 w-32 rounded-pill" />
          </div>
          <Skeleton className="h-46 w-full rounded-block" />
          <Skeleton className="h-18 w-full rounded-row" />
        </div>
      </div>
    );
  }

  return (
    <TicketWindow
      open={packageId !== null}
      onOpenChange={(next) => (next ? undefined : onClose())}
      mobile={mobile}
      description={t('description')}
    >
      {content}
    </TicketWindow>
  );
}

function TicketContent({
  pkg,
  mobile,
  onClose,
  studentHref,
  nowMs,
}: {
  pkg: PackageDetailResponse;
  mobile: boolean;
  onClose: () => void;
  studentHref?: (studentId: string) => string;
  nowMs?: number;
}) {
  const t = useTranslations('packages.ticket');
  const format = usePackageFormat();
  const titleOf = usePackageTitle();
  const clock = useNow();
  const [now] = useState(() => (nowMs ? new Date(nowMs) : clock));
  const [operation, setOperation] = useState<TicketOperation | null>(null);
  const ledger = usePackageLedgerQuery(pkg.id);
  const paymentsRead = usePackagePaymentsQuery(pkg.id);
  const payments: PaymentResponse[] = useMemo(
    () => paymentsRead.data?.items ?? [],
    [paymentsRead.data],
  );

  const state = ticketState(pkg, now);
  const dots = creditDots(pkg);
  const title = titleOf(pkg);
  const Title = mobile ? DrawerTitle : DialogTitle;
  const Icon = STATE_ICON[state];
  const currency = pkg.currency;
  const price = format.money(pkg.pricePerLessonMinorSnapshot, currency);
  const total = format.money(pkg.totalPriceMinorSnapshot, currency);
  const caption =
    state === 'new'
      ? t('caption.new', { price, total })
      : state === 'used'
        ? t('caption.used', { price, total })
        : state === 'expired'
          ? t('caption.expired', { count: dots.left, price, total })
          : t('caption.active', { count: Math.max(dots.total - dots.left, 0), price, total });
  const lessons = useMemo(() => ticketLessons(ledger.data?.items ?? []), [ledger.data]);
  const history = useMemo(
    () => ticketHistory(ledger.data?.items ?? [], payments, pkg),
    [ledger.data, payments, pkg],
  );
  const done = () => setOperation(null);
  const operationProps = { pkg, title, onClose: done, onDone: done };

  return (
    <>
      <PackageTicket
        state={state}
        grabber={mobile}
        className={mobile ? 'rounded-t-card' : 'rounded-hero'}
        label={t(`state.${state}`)}
        labelIcon={<Icon />}
        title={
          <Title className="truncate text-[22px] leading-7 font-bold tracking-[-0.01em]">
            {title}
          </Title>
        }
        subtitle={packageLine(pkg).join(' · ')}
        left={dots.left}
        total={dots.total}
        ofTotal={t('ofTotal', { count: pkg.lessonsTotal })}
        caption={caption}
        close={
          <IconButton
            icon={<XIcon />}
            label={t('close')}
            size={mobile ? 38 : 44}
            tone="paper"
            className="shrink-0 bg-card"
            onClick={onClose}
          />
        }
      >
        <TicketActions
          actions={ticketActions(pkg, state)}
          studentHref={studentHref ? studentHref(pkg.studentId) : null}
          onAction={setOperation}
        />
        <TicketMetrics
          pkg={pkg}
          state={state}
          payments={paymentsIn(payments)}
          studentFirstName={pkg.student.fullName.split(/\s+/)[0] ?? pkg.student.fullName}
          now={now}
          mobile={mobile}
          format={format}
        />
        <TicketActivity
          lessons={lessons}
          history={history}
          title={directionName(pkg)}
          currency={currency}
          loading={ledger.isPending}
          mobile={mobile}
          format={format}
        />
      </PackageTicket>

      {operation === 'pay' ? <PackagePaymentDialog {...operationProps} /> : null}
      {operation === 'extend' ? <ExtendDialog {...operationProps} /> : null}
      {operation === 'transfer' ? <TransferDialog {...operationProps} /> : null}
      {operation === 'refund' ? <RefundDialog {...operationProps} /> : null}
      {operation === 'adjust' ? <AdjustDialog {...operationProps} /> : null}
      {operation === 'delete' ? (
        <DeleteDialog
          {...operationProps}
          payments={payments}
          onDone={() => {
            done();
            onClose();
          }}
          onRefund={() => setOperation('refund')}
        />
      ) : null}
      {operation === 'sell' ? (
        <PackageSaleDialog
          open
          onOpenChange={(next) => (next ? undefined : done())}
          studentId={pkg.studentId}
          enrollmentId={pkg.enrollmentId}
          nowMs={nowMs}
        />
      ) : null}
    </>
  );
}
