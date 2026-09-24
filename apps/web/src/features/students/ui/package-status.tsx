'use client';

import { useTranslations } from 'next-intl';
import type {
  BillingTypeDto,
  PackagePaymentStatusDto,
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
