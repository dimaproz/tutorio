import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SIZE = {
  44: 'icon',
  38: 'icon-md',
  36: 'icon-sm',
  32: 'icon-xs',
} as const;

const TONE = {
  surface: 'surface',
  paper: 'paper',
  ghost: 'ghost',
  translucent: 'translucent',
} as const;

export type IconButtonSize = keyof typeof SIZE;
export type IconButtonTone = keyof typeof TONE;

/**
 * A round, icon-only command. The accessible name is mandatory: the glyph is
 * never announced, so `label` is what a screen reader says.
 */
export function IconButton({
  icon,
  label,
  size = 44,
  tone = 'surface',
  border = false,
  indicator = false,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'children' | 'aria-label'> & {
  icon: ReactNode;
  label: string;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  /** Hairline border, used where the disc sits on the same colour as its ground. */
  border?: boolean;
  /** Unread marker, e.g. on the notifications bell. */
  indicator?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={TONE[tone]}
      size={SIZE[size]}
      indicator={indicator}
      aria-label={label}
      data-slot="icon-button"
      className={cn(border && 'border-border hover:border-line-hover', className)}
      {...props}
    >
      {icon}
    </Button>
  );
}
