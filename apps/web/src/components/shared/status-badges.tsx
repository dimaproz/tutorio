'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { badgeVariantForTone, type StatusIcon, type StatusTone } from './status-meta';

/** Domain-neutral status presentation. Domain layers own DTO mappings and copy. */
export function StatusBadge({
  label,
  tone,
  icon: Icon,
}: {
  label: ReactNode;
  tone: StatusTone;
  icon?: StatusIcon;
}) {
  return (
    <Badge variant={badgeVariantForTone(tone)}>
      {Icon ? <Icon data-icon="inline-start" /> : null}
      {label}
    </Badge>
  );
}

export function DeletedBadge({ label }: { label: string }) {
  return <StatusBadge label={label} tone="destructive" />;
}
