'use client';

import { useTranslations } from 'next-intl';
import type { BillingTypeDto, EnrollmentStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';

// Business statuses map onto Badge variants and semantic tokens — never raw
// color utilities — so light and dark themes stay consistent.
const STATUS_VARIANT: Record<EnrollmentStatusDto, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  ARCHIVED: 'outline',
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatusDto }) {
  const t = useTranslations('enrollmentStatus');
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

export function BillingTypeBadge({ billingType }: { billingType: BillingTypeDto }) {
  const t = useTranslations('billingType');
  return <Badge variant="outline">{t(billingType)}</Badge>;
}

export function DeletedBadge({ label }: { label: string }) {
  return <Badge variant="destructive">{label}</Badge>;
}
