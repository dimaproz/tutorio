import type { ReactNode } from 'react';
import { AlertCircleIcon, CheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const TONE_ICON = {
  danger: AlertCircleIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
  success: CheckIcon,
  indigo: InfoIcon,
  neutral: InfoIcon,
} as const;

// The callout paints its block in the tone's tint; the title and the icon take
// the tone's foreground, the text the shared body colour on a tint.
const CALLOUT_TONE = {
  danger: { block: 'bg-tint-danger', accent: 'text-tint-danger-foreground' },
  warning: { block: 'bg-tint-warning', accent: 'text-tint-warning-foreground' },
  info: { block: 'bg-tint-info', accent: 'text-tint-info-foreground' },
  success: { block: 'bg-tint-success', accent: 'text-tint-success-foreground' },
  indigo: { block: 'bg-tint-indigo', accent: 'text-tint-indigo-foreground' },
  neutral: { block: 'bg-secondary', accent: 'text-foreground' },
} as const;

export type NoticeTone = keyof typeof TONE_ICON;
export type NoticeAppearance = 'banner' | 'callout';

/**
 * A tinted status block. The `banner` (default) carries request errors,
 * lifecycle banners on a profile and success confirmations; it knows the
 * danger, warning, info and success tones. The `callout` is the explanation
 * inside a decision dialog — a 36px white icon tile, a title in the tone's
 * colour and a short text — and also knows `indigo` and `neutral`. Each tone
 * brings a plain glyph (info, warning triangle, alert, check); a caller whose
 * context has its own sign — a pause, an archive — passes it as `icon`. The action is a caller-owned
 * control, typically a white `xs` button.
 */
export function Notice({
  tone = 'danger',
  appearance = 'banner',
  title,
  text,
  action,
  icon,
  actionPlacement = 'inline',
  className,
}: {
  tone?: NoticeTone;
  appearance?: NoticeAppearance;
  title?: ReactNode;
  text: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  /**
   * `stacked` moves a banner's actions under its text on phones (a pause
   * banner with two actions); `inline` keeps them on the trailing edge.
   */
  actionPlacement?: 'inline' | 'stacked';
  className?: string;
}) {
  const Icon = TONE_ICON[tone];
  const role = tone === 'danger' ? 'alert' : 'status';

  if (appearance === 'callout') {
    const palette = CALLOUT_TONE[tone];
    return (
      <div
        role={role}
        data-slot="notice"
        data-appearance="callout"
        data-tone={tone}
        className={cn(
          'flex items-start gap-3 rounded-tile px-3.5 py-3',
          palette.block,
          action && 'items-center',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-control bg-card [&_svg]:size-4.5',
            palette.accent,
          )}
        >
          {icon ?? <Icon />}
        </span>
        <div className="flex min-w-0 grow flex-col gap-0.5 pt-px">
          {title ? (
            <span className={cn('text-sm leading-5 font-semibold', palette.accent)}>{title}</span>
          ) : null}
          <span
            className={cn(
              'text-[13px] leading-[19px]',
              tone === 'neutral' ? 'text-muted-foreground' : 'text-tint-foreground',
            )}
          >
            {text}
          </span>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    );
  }

  // The banner keeps the four tones its Alert variants define.
  const variant = tone === 'indigo' || tone === 'neutral' ? 'info' : tone;
  return (
    // Only an error interrupts; lifecycle and success banners are polite.
    <Alert
      variant={variant}
      role={role}
      data-slot="notice"
      className={cn(action && 'items-center', className)}
    >
      {icon ?? <Icon aria-hidden="true" />}
      {title ? <AlertTitle className="text-sm leading-5 font-semibold">{title}</AlertTitle> : null}
      <AlertDescription className="text-[13px] leading-[19px]">{text}</AlertDescription>
      {action ? (
        <AlertAction
          className={cn(
            actionPlacement === 'stacked' &&
              'max-md:col-start-2! max-md:row-span-1 max-md:row-start-3 max-md:mt-2 max-md:justify-self-start',
          )}
        >
          {action}
        </AlertAction>
      ) : null}
    </Alert>
  );
}
