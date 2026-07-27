'use client';

import { useTranslations } from 'next-intl';
import type {
  BillingTypeDto,
  EnrollmentStatusDto,
  LessonStatusDto,
  PackagePaymentStatusDto,
  PaymentStatusDto,
  StudentStatusDto,
} from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import {
  badgeVariantForTone,
  ENROLLMENT_STATUS_META,
  STUDENT_STATUS_META,
  type StatusMeta,
} from '@/components/app/status-meta';

// Lifecycle labels are shadcn Badge variants. Domain status names only map to
// user-configurable semantic theme roles; they never define a colour. Icon and
// role both come from the shared status registry, so the badge, the picker and
// the list filter always agree.
function StatusMetaBadge({ meta, label }: { meta: StatusMeta; label: string }) {
  const Icon = meta.icon;
  return (
    <Badge variant={badgeVariantForTone(meta.tone)}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}

export function StudentStatusBadge({ status }: { status: StudentStatusDto }) {
  const t = useTranslations('studentStatus');
  return <StatusMetaBadge meta={STUDENT_STATUS_META[status]} label={t(status)} />;
}

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatusDto }) {
  const t = useTranslations('enrollmentStatus');
  return <StatusMetaBadge meta={ENROLLMENT_STATUS_META[status]} label={t(status)} />;
}

const LESSON_VARIANT: Record<
  LessonStatusDto,
  'primary' | 'success' | 'destructive' | 'warning'
> = {
  SCHEDULED: 'primary',
  COMPLETED: 'success',
  CANCELLED_CHARGED: 'destructive',
  CANCELLED_UNCHARGED: 'warning',
};

export function LessonStatusBadge({ status }: { status: LessonStatusDto }) {
  const t = useTranslations('scheduling.status');
  return <Badge variant={LESSON_VARIANT[status]}>{t(status)}</Badge>;
}

export function BillingTypeBadge({ billingType }: { billingType: BillingTypeDto }) {
  const t = useTranslations('billingType');
  return <Badge variant="secondary">{t(billingType)}</Badge>;
}

const PACKAGE_PAYMENT_VARIANT: Record<
  PackagePaymentStatusDto,
  'success' | 'warning' | 'destructive'
> = {
  PAID: 'success',
  PARTIAL: 'warning',
  PENDING: 'destructive',
};

export function PackagePaymentStatusBadge({
  status,
}: {
  status: PackagePaymentStatusDto;
}) {
  const t = useTranslations('packages.paymentStatus');
  return <Badge variant={PACKAGE_PAYMENT_VARIANT[status]}>{t(status)}</Badge>;
}

const PAYMENT_VARIANT: Record<
  PaymentStatusDto,
  'success' | 'warning' | 'destructive' | 'secondary'
> = {
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatusDto }) {
  const t = useTranslations('packages.paymentState');
  return <Badge variant={PAYMENT_VARIANT[status]}>{t(status)}</Badge>;
}

export function DeletedBadge({ label }: { label: string }) {
  return <Badge variant="destructive">{label}</Badge>;
}
