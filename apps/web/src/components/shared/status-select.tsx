'use client';

import { toneTextClass, type StatusIcon, type StatusTone } from './status-meta';
import { cn } from '@/lib/utils';

export type { StatusTone };

export interface StatusOption {
  value: string;
  label: string;
  tone: StatusTone;
  icon: StatusIcon;
}
/** Icon + label line shared by the status picker and the list status filter. */
export function StatusRow({
  icon: Icon,
  tone,
  label,
}: {
  icon: StatusIcon;
  tone: StatusTone;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className={cn('shrink-0', toneTextClass[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}
