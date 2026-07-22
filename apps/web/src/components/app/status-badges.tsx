'use client';

import { useTranslations } from 'next-intl';
import type { BillingTypeDto, EnrollmentStatusDto } from '@tutorio/validation';
import { cn } from '@/lib/utils';

// Product status pill — matches the /design lab's StatusBadge formula: a light
// wash background + the same-hue 600 text, always rounded-full, driven by the
// semantic --status-* CSS variables (never raw Tailwind colours) so light and
// dark themes stay consistent. `neutral` uses the muted token for attributes
// that are not lifecycle statuses (e.g. billing type).
type StatusToken = 'active' | 'paused' | 'overdue' | 'paid' | 'archived' | 'neutral';

const PILL_BASE =
  'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap';

export function StatusPill({
  token,
  children,
  className,
}: {
  token: StatusToken;
  children: React.ReactNode;
  className?: string;
}) {
  if (token === 'neutral') {
    return (
      <span className={cn(PILL_BASE, 'bg-muted text-muted-foreground', className)}>{children}</span>
    );
  }
  return (
    <span
      className={cn(PILL_BASE, className)}
      style={{
        backgroundColor: `var(--status-${token}-wash)`,
        color: `var(--status-${token})`,
      }}
    >
      {children}
    </span>
  );
}

const ENROLLMENT_TOKEN: Record<EnrollmentStatusDto, StatusToken> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatusDto }) {
  const t = useTranslations('enrollmentStatus');
  return <StatusPill token={ENROLLMENT_TOKEN[status]}>{t(status)}</StatusPill>;
}

export function BillingTypeBadge({ billingType }: { billingType: BillingTypeDto }) {
  const t = useTranslations('billingType');
  return <StatusPill token="neutral">{t(billingType)}</StatusPill>;
}

export function DeletedBadge({ label }: { label: string }) {
  return <StatusPill token="overdue">{label}</StatusPill>;
}
