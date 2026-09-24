import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONE = {
  muted: { text: 'text-muted-foreground', icon: 'text-brand' },
  brand: { text: 'text-tint-foreground', icon: 'text-brand' },
  warning: { text: 'text-tint-warning-foreground', icon: 'text-tint-warning-foreground' },
} as const;

export type FieldNoteTone = keyof typeof TONE;

/**
 * A one-line explanation beside a field: an icon and 13px text. `plain`
 * sits under a field or a card (a schedule note, a busy teacher, an overlap,
 * the package note in the band); `strip` is the sky block of a substitute
 * teacher, with an optional action link at its end. It is not announced: the
 * field's own hint carries anything a screen reader must hear.
 */
export function FieldNote({
  icon,
  tone = 'muted',
  appearance = 'plain',
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  tone?: FieldNoteTone;
  appearance?: 'plain' | 'strip';
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const palette = TONE[tone];
  return (
    <div
      data-slot="field-note"
      className={cn(
        'flex items-start gap-2 text-[13px] leading-[18px]',
        appearance === 'strip'
          ? 'items-center gap-2.5 rounded-control bg-tint-sky px-3.5 py-2.5 text-tint-foreground'
          : palette.text,
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex shrink-0 [&_svg]:size-3.5',
            appearance === 'strip' ? 'text-brand [&_svg]:size-4' : cn('mt-0.5', palette.icon),
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 grow">{children}</span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
