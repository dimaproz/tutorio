import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The card repeats the tone of the lesson's status: a charged cancellation is
// danger, a free one warning.
const TONE = {
  danger: { block: 'bg-tint-danger', accent: 'text-tint-danger-foreground' },
  warning: { block: 'bg-tint-warning', accent: 'text-tint-warning-foreground' },
} as const;

export type CancellationCardTone = keyof typeof TONE;

/**
 * Why and how a lesson was called off, at the top of the lesson panel: a
 * white icon tile with the status icon, who cancelled in the tone's colour,
 * the reason (bold) with when it happened, and one line explaining
 * what it meant for the charge.
 */
export function LessonCancellationCard({
  tone,
  icon,
  title,
  reason,
  when,
  text,
  className,
}: {
  tone: CancellationCardTone;
  icon: ReactNode;
  /** Who cancelled, e.g. "Cancelled by the student, late · Olena Kovalenko". */
  title: ReactNode;
  /** The reason, already quoted in the locale's style; set bold. */
  reason?: ReactNode;
  /** "11 Sep at 14:05, 3 h before". */
  when?: ReactNode;
  /** What it meant, e.g. "Past the 24 h deadline — charged from the package." */
  text?: ReactNode;
  className?: string;
}) {
  const palette = TONE[tone];

  return (
    <div
      data-slot="lesson-cancellation-card"
      data-tone={tone}
      className={cn(
        'flex shrink-0 items-start gap-3.5 rounded-row px-4 py-3.5',
        palette.block,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-item bg-card [&_svg]:size-5',
          palette.accent,
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('text-[15px] leading-5 font-semibold', palette.accent)}>{title}</span>
        {reason || when ? (
          <span className="text-[13px] leading-[18px] text-tint-foreground">
            {reason ? <b className="font-semibold">{reason}</b> : null}
            {reason && when ? ' · ' : null}
            {when}
          </span>
        ) : null}
        {text ? (
          <span className="text-[13px] leading-[18px] text-tint-foreground opacity-80">{text}</span>
        ) : null}
      </div>
    </div>
  );
}
