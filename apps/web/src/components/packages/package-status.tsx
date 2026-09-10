'use client';

import { useTranslations } from 'next-intl';
import type {
  BillingTypeDto,
  PackagePaymentStatusDto,
  PaymentStatusDto,
} from '@tutorio/validation';
import { StatusBadge } from '@/components/shared/status-badges';

export function BillingTypeBadge({ billingType }: { billingType: BillingTypeDto }) {
  const t = useTranslations('billingType');
  return <StatusBadge label={t(billingType)} tone="secondary" />;
}

export function PackagePaymentStatusBadge({ status }: { status: PackagePaymentStatusDto }) {
  const t = useTranslations('packages.paymentStatus');
  const tone = status === 'PAID' ? 'success' : status === 'PARTIAL' ? 'warning' : 'destructive';
  return <StatusBadge label={t(status)} tone={tone} />;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatusDto }) {
  const t = useTranslations('packages.paymentState');
  const tone =
    status === 'PAID'
      ? 'success'
      : status === 'PENDING'
        ? 'warning'
        : status === 'FAILED'
          ? 'destructive'
          : 'secondary';
  return <StatusBadge label={t(status)} tone={tone} />;
}
