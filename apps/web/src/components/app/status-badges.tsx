'use client';

import { useTranslations } from 'next-intl';
import type { BillingTypeDto, EnrollmentStatusDto, StudentStatusDto } from '@tutorio/validation';
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

export function BillingTypeBadge({ billingType }: { billingType: BillingTypeDto }) {
  const t = useTranslations('billingType');
  return <Badge variant="secondary">{t(billingType)}</Badge>;
}

export function DeletedBadge({ label }: { label: string }) {
  return <Badge variant="destructive">{label}</Badge>;
}
