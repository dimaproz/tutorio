import type { ReactNode } from 'react';
import { TicketArt } from '@/components/shared/pass-art';
import { cn } from '@/lib/utils';
import type { TicketState } from '../model/ticket';
import { CreditDots, type DotTone } from './credit-dots';
import { notchMask } from './notch';

/** The stub's tint per state (decision 11): indigo new and active, grey used up, warning expired. */
const TONE: Record<TicketState, { block: string; accent: string; art: string; dots: DotTone }> = {
  new: { block: 'bg-tint-indigo', accent: 'text-brand', art: 'text-brand', dots: 'brand' },
  active: { block: 'bg-tint-indigo', accent: 'text-brand', art: 'text-brand', dots: 'brand' },
  used: {
    block: 'bg-secondary',
    accent: 'text-muted-foreground',
    art: 'text-muted-foreground',
    dots: 'muted',
  },
  expired: {
    block: 'bg-tint-warning',
    accent: 'text-tint-warning-foreground',
    art: 'text-tint-warning-foreground',
    dots: 'warning',
  },
};

/** Where the tear line runs: the stub's height. */
const STUB = 250;
const NOTCH = 14;

/**
 * The package as a vertical ticket (S07 board 02, components): the 250px
 * stub in the state's tint — its label, title, who it is for, the count
 * with its credit dots, a caption and the ticket art —, a dashed tear line
 * with two notches, and the white body the caller fills.
 */
export function PackageTicket({
  state,
  label,
  labelIcon,
  title,
  subtitle,
  left,
  total,
  ofTotal,
  caption,
  close,
  grabber,
  children,
  className,
}: {
  state: TicketState;
  label: ReactNode;
  labelIcon: ReactNode;
  /** The title element, e.g. the dialog's title. */
  title: ReactNode;
  subtitle: ReactNode;
  left: number;
  total: number;
  /** «з 8 занять». */
  ofTotal: ReactNode;
  caption: ReactNode;
  /** The round close button in the corner. */
  close?: ReactNode;
  /** The phone sheet's handle on the stub. */
  grabber?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const tone = TONE[state];
  return (
    <article
      data-slot="package-ticket"
      data-state={state}
      style={notchMask({ y: STUB }, NOTCH)}
      className={cn('flex flex-col overflow-hidden bg-card text-card-foreground', className)}
    >
      <div
        className={cn('relative flex shrink-0 flex-col px-6 pt-5.5 pb-6.5', tone.block)}
        style={{ height: STUB }}
      >
        {grabber ? (
          <span
            aria-hidden="true"
            className="absolute top-2.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-pill bg-foreground/15"
          />
        ) : null}
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 grow flex-col gap-1">
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs font-bold tracking-[0.06em] uppercase [&_svg]:size-3.5',
                tone.accent,
              )}
            >
              {labelIcon}
              {label}
            </span>
            {title}
            <span className="truncate text-sm text-tint-foreground">{subtitle}</span>
          </div>
          {close}
        </div>
        <div className="mt-auto flex items-end gap-3">
          <div className="flex min-w-0 grow flex-col gap-2.5">
            <div className="flex items-baseline gap-3">
              <span className="text-[52px] leading-none font-bold tracking-[-0.03em] tabular-nums">
                {left}
              </span>
              <span className="text-xl font-semibold opacity-60">{ofTotal}</span>
            </div>
            <CreditDots left={left} total={total} tone={tone.dots} size="md" />
            <span className="text-[13px] leading-[18px] text-tint-foreground">{caption}</span>
          </div>
          <TicketArt className={cn('mb-7 hidden h-17 w-21 shrink-0 sm:block', tone.art)} />
        </div>
      </div>
      <div aria-hidden="true" className="mx-6.5 shrink-0 border-t-2 border-dashed border-border" />
      <div className="flex flex-col gap-4 px-6 pt-5 pb-6">{children}</div>
    </article>
  );
}
