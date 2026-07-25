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

// Lifecycle labels are shadcn Badge variants. Domain status names only map to
// user-configurable semantic theme roles; they never define a colour.
export function StudentStatusBadge({ status }: { status: StudentStatusDto }) {
  const t = useTranslations('studentStatus');
  const variant: Record<StudentStatusDto, 'primary' | 'warning' | 'secondary'> = {
    ACTIVE: 'primary',
    ON_HOLD: 'warning',
    ARCHIVED: 'secondary',
  };
  return <Badge variant={variant[status]}>{t(status)}</Badge>;
}

const ENROLLMENT_VARIANT: Record<EnrollmentStatusDto, 'primary' | 'warning' | 'secondary'> = {
  ACTIVE: 'primary',
  PAUSED: 'warning',
  ARCHIVED: 'secondary',
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatusDto }) {
  const t = useTranslations('enrollmentStatus');
  return <Badge variant={ENROLLMENT_VARIANT[status]}>{t(status)}</Badge>;
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
