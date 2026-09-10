import type { ComponentType } from 'react';
export type StatusTone =
  'primary' | 'warning' | 'secondary' | 'destructive' | 'success' | 'neutral';

export type StatusIcon = ComponentType<{ className?: string }>;

export interface StatusMeta {
  tone: StatusTone;
  icon: StatusIcon;
}

export const toneTextClass: Record<StatusTone, string> = {
  primary: 'text-primary',
  warning: 'text-warning',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive',
  success: 'text-success',
  neutral: 'text-muted-foreground',
};

/** `neutral` has no pill of its own; it reads as the muted secondary badge. */
export function badgeVariantForTone(
  tone: StatusTone,
): 'primary' | 'warning' | 'secondary' | 'destructive' | 'success' {
  return tone === 'neutral' ? 'secondary' : tone;
}
