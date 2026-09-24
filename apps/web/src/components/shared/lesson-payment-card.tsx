import type { ReactNode } from 'react';
import { RingsArt } from '@/components/shared/rings-art';
import { cn } from '@/lib/utils';

const TONE = {
  indigo: {
    card: 'bg-tint-indigo text-tint-foreground',
    label: 'text-tint-indigo-meta',
    art: 'text-brand',
  },
  sky: {
    card: 'bg-tint-sky text-tint-foreground',
    label: 'text-tint-indigo-meta',
    art: 'text-brand',
  },
  success: {
    card: 'bg-tint-success text-tint-success-foreground',
    label: 'text-current',
    art: 'text-current',
  },
  warning: {
    card: 'bg-tint-warning text-tint-warning-foreground',
    label: 'text-current',
    art: 'text-current',
  },
} as const;

// One pill per package credit: spent before, this lesson, charged by a
// cancellation or a miss, and still available.
const SEGMENT = {
  used: 'bg-tint-foreground/16',
  current: 'bg-brand-soft ring-2 ring-card',
  charged: 'bg-danger-mark',
  available: 'bg-brand',
} as const;

export type PaymentCardTone = keyof typeof TONE;
export type PaymentCardArt = 'rings' | 'cards' | 'check';
export type PaymentSegment = keyof typeof SEGMENT;

function Art({ art }: { art: PaymentCardArt }) {
  if (art === 'rings') {
    return <RingsArt className="-top-5 -right-10 opacity-18" />;
  }
  if (art === 'cards') {
    return (
      <svg
        viewBox="0 0 220 160"
        aria-hidden="true"
        className="pointer-events-none absolute -top-4.5 -right-5 h-40 w-55 opacity-20"
      >
        <rect
          x="96"
          y="30"
          width="120"
          height="84"
          rx="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
        />
        <circle cx="156" cy="72" r="16" fill="currentColor" />
        <rect
          x="70"
          y="100"
          width="120"
          height="84"
          rx="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 220 160"
      aria-hidden="true"
      className="pointer-events-none absolute -top-4 -right-6 h-40 w-55 opacity-20"
    >
      <circle cx="152" cy="80" r="64" fill="none" stroke="currentColor" strokeWidth="14" />
      <path
        d="M118 82 L142 104 L186 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * How one lesson is paid, as the lesson panel's payment block: a tinted card
 * with a decorative drawing in its corner, an overline and a chip, then the
 * figure — package credits ("5 з 8" with a caption), a money amount, or a
 * word ("Free") — and what follows it: the credit meter with its package line
 * and legend, a sentence, chips, an action, and a footer under a divider.
 * The feature decides the variant; the card owns no copy.
 */
export function LessonPaymentCard({
  tone,
  art,
  label,
  badge,
  figure,
  headline,
  segments,
  detail,
  legend,
  text,
  chips,
  action,
  footer,
  className,
}: {
  tone: PaymentCardTone;
  art: PaymentCardArt;
  /** Overline, e.g. "Оплата · пакет". */
  label: string;
  /** Chip on the overline's right, e.g. an `on-tint` Badge. */
  badge?: ReactNode;
  /**
   * The number: `count` sets "5" big with "з 8" beside it and the caption
   * after; `money` sets "500" big with a larger currency sign.
   */
  figure?: { value: string; unit?: string; caption?: string; kind: 'count' | 'money' };
  /** A word in place of a number, e.g. "Безкоштовне". */
  headline?: string;
  /** The credit meter, one pill per package credit. */
  segments?: PaymentSegment[];
  /** The package line under the meter. */
  detail?: ReactNode;
  /** The dot legend beside the package line. */
  legend?: { segment: PaymentSegment; label: string };
  /** A sentence, e.g. "Will be charged after the lesson, 11 Sep at 18:00". */
  text?: ReactNode;
  /** A row of `on-tint` chips. */
  chips?: ReactNode;
  /** A white button beside the sentence, e.g. "Record a payment". */
  action?: ReactNode;
  /** A line and an action under a divider, e.g. the package running out. */
  footer?: { text: ReactNode; action?: ReactNode };
  className?: string;
}) {
  const palette = TONE[tone];

  return (
    <section
      aria-label={label}
      data-slot="lesson-payment-card"
      data-tone={tone}
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden rounded-block p-5',
        palette.card,
        className,
      )}
    >
      <div className={palette.art}>
        <Art art={art} />
      </div>
      <div className="relative flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className={cn('text-xs font-semibold tracking-[0.04em] uppercase', palette.label)}>
            {label}
          </span>
          {badge}
        </div>
        {figure ? (
          <div className="flex flex-wrap items-end gap-x-1.5 gap-y-1">
            <span className="text-[44px] leading-11 font-semibold tracking-[-0.03em] tabular-nums">
              {figure.value}
            </span>
            {figure.unit ? (
              <span
                className={cn(
                  'font-semibold',
                  figure.kind === 'money' ? 'text-2xl leading-9' : 'text-lg leading-6',
                )}
              >
                {figure.unit}
              </span>
            ) : null}
            {figure.caption ? (
              <span className={cn('ml-2 text-[13px] leading-[18px]', palette.label)}>
                {figure.caption}
              </span>
            ) : null}
          </div>
        ) : null}
        {headline ? (
          <span className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
            {headline}
          </span>
        ) : null}
        {segments && segments.length > 0 ? (
          <div aria-hidden="true" className="flex gap-[5px]">
            {segments.map((segment, index) => (
              <span key={index} className={cn('h-2.5 flex-1 rounded-pill', SEGMENT[segment])} />
            ))}
          </div>
        ) : null}
        {detail || legend ? (
          <div className="flex items-center justify-between gap-2.5">
            <span className={cn('text-[13px] leading-[18px]', palette.label)}>{detail}</span>
            {legend ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap',
                  palette.label,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 rounded-pill', SEGMENT[legend.segment], 'ring-0')}
                />
                {legend.label}
              </span>
            ) : null}
          </div>
        ) : null}
        {chips ? <div className="flex flex-wrap items-center gap-2">{chips}</div> : null}
        {text || action ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {text ? <span className="text-sm leading-5 text-tint-foreground">{text}</span> : null}
            {action}
          </div>
        ) : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-t border-tint-foreground/12 pt-3">
            <span className="text-[13px] leading-[18px] text-tint-foreground">{footer.text}</span>
            {footer.action}
          </div>
        ) : null}
      </div>
    </section>
  );
}
