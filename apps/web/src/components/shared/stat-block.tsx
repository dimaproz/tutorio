import type { ReactNode } from 'react';
import { ArrowRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Every tone is a painted surface with its own foreground, muted text, chart
// track and divider, so a block reads the same wherever it is placed.
const TONE = {
  surface: {
    surface: 'bg-card text-card-foreground',
    muted: 'text-muted-foreground',
    track: 'bg-stat-track',
    trackStroke: 'stroke-stat-track',
    divider: 'border-stat-divider',
    highlight: 'bg-brand',
    highlightStroke: 'stroke-brand',
  },
  tint: {
    surface: 'bg-tint-indigo text-ink',
    muted: 'text-tint-indigo-muted',
    track: 'bg-ink/12',
    trackStroke: 'stroke-ink/12',
    divider: 'border-ink/10',
    highlight: 'bg-brand',
    highlightStroke: 'stroke-brand',
  },
  accent: {
    surface: 'bg-tint-sky text-ink',
    muted: 'text-tint-sky-muted',
    track: 'bg-brand/16',
    trackStroke: 'stroke-brand/16',
    divider: 'border-brand/14',
    highlight: 'bg-brand',
    highlightStroke: 'stroke-brand',
  },
  ink: {
    surface: 'bg-ink text-ink-foreground',
    muted: 'text-ink-muted',
    track: 'bg-white/16',
    trackStroke: 'stroke-white/16',
    divider: 'border-white/12',
    highlight: 'bg-ink-foreground',
    highlightStroke: 'stroke-ink-foreground',
  },
} as const;

const ACTION_VARIANT = {
  surface: 'outline',
  tint: 'white',
  accent: 'white',
  ink: 'soft',
} as const;

export type StatBlockTone = keyof typeof TONE;
export type StatBlockBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type StatBlockSegment = 'ok' | 'miss' | 'planned';

export type StatBlockProps = {
  label: string;
  caption?: ReactNode;
  /** Trailing footer note in mono figures. Replaced by `action` when both are set. */
  detail?: ReactNode;
  /** Footer command, e.g. "Offer top-up". Takes the place of `detail`. */
  action?: { label: ReactNode; onClick?: () => void };
  badge?: { label: ReactNode; tone: StatBlockBadgeTone };
  tone?: StatBlockTone;
  className?: string;
} & (
  | {
      type: 'amount';
      value: ReactNode;
      unit?: ReactNode;
      /** Secondary figure on the right of the value, e.g. "500 ₴". */
      aside?: ReactNode;
      /** Caption under `aside`, e.g. "per lesson". */
      asideLabel?: ReactNode;
    }
  | { type: 'date'; value: ReactNode; sub?: ReactNode }
  | ({ type: 'chart'; value: ReactNode } & StatBlockChart)
  | { type: 'custom'; items: { label: string; value: ReactNode; percent: number }[] }
);

type StatBlockChart =
  | { chart: 'bars'; data: number[] }
  | { chart: 'ring'; percent: number }
  | { chart: 'segments'; data: StatBlockSegment[] };

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

/**
 * The universal metric block. One shape — header, value zone, footer — with
 * four value types and four painted tones. Charts are decorative: the value
 * and caption always carry the meaning.
 */
export function StatBlock(props: StatBlockProps) {
  const { label, caption, detail, action, badge, tone = 'surface', className } = props;
  const theme = TONE[tone];

  return (
    <section
      data-slot="stat-block"
      data-tone={tone}
      className={cn(
        'flex h-46 w-full flex-col gap-2.5 rounded-block pt-5 pr-[22px] pb-[18px] pl-[22px]',
        theme.surface,
        className,
      )}
    >
      <div className="flex h-6.5 items-center justify-between gap-2">
        <span className={cn('min-w-0 truncate text-sm leading-5 font-medium', theme.muted)}>
          {label}
        </span>
        {badge ? (
          <Badge
            size="sm"
            variant={badge.tone}
            className={cn(
              'shrink-0',
              tone === 'ink' && badge.tone === 'neutral' && 'bg-white/15 text-ink-foreground',
            )}
          >
            {badge.label}
          </Badge>
        ) : null}
      </div>

      <div className="flex min-h-0 grow items-end justify-between gap-3">
        <StatBlockValue {...props} theme={theme} />
      </div>

      <div
        className={cn(
          'flex items-center justify-between gap-2 border-t',
          theme.divider,
          // The reference measures the footer as content plus its top padding
          // and rule, so the heights here are that total: 20+12+1 and 32+10+1.
          action ? 'h-[43px] pt-2.5' : 'h-[33px] pt-3',
        )}
      >
        <span className={cn('min-w-0 truncate text-[13px] leading-[18px]', theme.muted)}>
          {caption}
        </span>
        {action ? (
          <Button
            type="button"
            size="xs"
            variant={ACTION_VARIANT[tone]}
            onClick={action.onClick}
            className="shrink-0"
          >
            {action.label}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : (
          <span className="shrink-0 font-mono text-xs leading-[18px] whitespace-nowrap">
            {detail}
          </span>
        )}
      </div>
    </section>
  );
}

function StatBlockValue(props: StatBlockProps & { theme: (typeof TONE)[StatBlockTone] }) {
  const { theme } = props;

  if (props.type === 'amount') {
    return (
      <>
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[40px] leading-[44px] font-semibold tracking-[-0.03em] whitespace-nowrap tabular-nums">
            {props.value}
          </span>
          {props.unit ? (
            <span className={cn('text-[22px] leading-7 font-medium', theme.muted)}>
              {props.unit}
            </span>
          ) : null}
        </div>
        {props.aside ? (
          <div className="flex shrink-0 flex-col items-end gap-0.5 pb-1 text-right">
            <span className="text-lg leading-[22px] font-semibold tracking-[-0.01em] whitespace-nowrap">
              {props.aside}
            </span>
            {props.asideLabel ? (
              <span className={cn('text-xs leading-4 whitespace-nowrap', theme.muted)}>
                {props.asideLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  if (props.type === 'date') {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
          {props.value}
        </span>
        {props.sub ? (
          <span className={cn('font-mono text-sm leading-5', theme.muted)}>{props.sub}</span>
        ) : null}
      </div>
    );
  }

  if (props.type === 'custom') {
    return (
      <div className="flex grow flex-col justify-end gap-1">
        {props.items.slice(0, 4).map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[76px_minmax(0,1fr)_36px] items-center gap-2.5 text-xs leading-[14px]"
          >
            <span className="truncate">{item.label}</span>
            <span className={cn('h-1.5 overflow-hidden rounded-pill', theme.track)}>
              <span
                className={cn('block h-1.5 rounded-pill', theme.highlight)}
                style={{ width: `${clampPercent(item.percent)}%` }}
              />
            </span>
            <span className={cn('text-right font-mono text-xs', theme.muted)}>{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <span className="text-[36px] leading-10 font-semibold tracking-[-0.03em] whitespace-nowrap tabular-nums">
        {props.value}
      </span>
      <StatBlockChartVisual {...props} theme={theme} />
    </>
  );
}

function StatBlockChartVisual(
  props: { type: 'chart' } & StatBlockChart & { theme: (typeof TONE)[StatBlockTone] },
) {
  const { theme } = props;

  if (props.chart === 'bars') {
    const max = Math.max(1, ...props.data);
    return (
      <div aria-hidden="true" className="flex h-12 items-end gap-1">
        {props.data.map((value, index) => (
          <span
            // Bars are positional samples of one series, so the index is the identity.
            key={index}
            style={{ height: Math.max(4, Math.round((value / max) * 48)) }}
            className={cn(
              'w-2 rounded-[3px]',
              index === props.data.length - 1 ? theme.highlight : theme.track,
            )}
          />
        ))}
      </div>
    );
  }

  if (props.chart === 'ring') {
    const filled = (RING_CIRCUMFERENCE * clampPercent(props.percent)) / 100;
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="size-16 shrink-0">
        <circle
          cx="32"
          cy="32"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="8"
          className={theme.trackStroke}
        />
        <circle
          cx="32"
          cy="32"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${RING_CIRCUMFERENCE.toFixed(1)}`}
          transform="rotate(-90 32 32)"
          className={theme.highlightStroke}
        />
      </svg>
    );
  }

  return (
    <div aria-hidden="true" className="grid w-fit grid-cols-6 gap-[5px]">
      {props.data.map((segment, index) => (
        <span
          // Attendance cells are positional, so the index is the identity.
          key={index}
          className={cn(
            'size-3.5 rounded-[4px]',
            segment === 'ok' && 'bg-success',
            segment === 'miss' && 'bg-danger-mark',
            segment === 'planned' && theme.track,
          )}
        />
      ))}
    </div>
  );
}
