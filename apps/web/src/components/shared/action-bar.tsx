import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const NOTE_TONE = {
  muted: { text: 'text-muted-foreground', dot: null },
  danger: { text: 'text-destructive', dot: 'bg-danger-mark' },
  warning: { text: 'text-tint-warning-foreground', dot: 'bg-warning' },
  success: { text: 'text-muted-foreground', dot: 'bg-success' },
} as const;

export type ActionBarTone = keyof typeof NOTE_TONE;

/**
 * The sticky save bar under a long form: a status note on the left, then an
 * optional back control and the secondary and primary commands. The caller
 * owns the buttons, so busy and disabled states stay with the mutation.
 */
export function ActionBar({
  note,
  tone = 'muted',
  back,
  secondary,
  primary,
  sticky = true,
  className,
}: {
  note?: ReactNode;
  tone?: ActionBarTone;
  back?: ReactNode;
  secondary?: ReactNode;
  primary: ReactNode;
  /** Pins the bar to the bottom of the scrolling page. */
  sticky?: boolean;
  className?: string;
}) {
  const noteTone = NOTE_TONE[tone];

  return (
    <div
      data-slot="action-bar"
      className={cn(
        'z-10 flex w-full flex-wrap items-center gap-3 rounded-block border border-border bg-card py-3 pr-3 pl-5.5 shadow-bar',
        sticky && 'sticky bottom-4',
        className,
      )}
    >
      {back}
      {note ? (
        // Status changes of the form are announced without moving focus.
        <span
          role="status"
          className={cn('flex min-w-0 items-center gap-2 text-[13px] font-medium', noteTone.text)}
        >
          {noteTone.dot ? (
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-pill', noteTone.dot)} />
          ) : null}
          {note}
        </span>
      ) : null}
      <span aria-hidden="true" className="grow" />
      <div className="flex items-center gap-3">
        {secondary}
        {primary}
      </div>
    </div>
  );
}
