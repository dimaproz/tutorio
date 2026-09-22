import type { ReactNode } from 'react';
import { AlertCircleIcon, ArchiveIcon, CheckIcon, PauseIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const TONE_ICON = {
  danger: AlertCircleIcon,
  warning: ArchiveIcon,
  info: PauseIcon,
  success: CheckIcon,
} as const;

export type NoticeTone = keyof typeof TONE_ICON;

/**
 * A tinted status banner: request errors, lifecycle banners on a profile, and
 * success confirmations. Each tone brings its default glyph; `icon` overrides
 * it. The action is a caller-owned control, typically a white `xs` button.
 */
export function Notice({
  tone = 'danger',
  title,
  text,
  action,
  icon,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  text: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];

  return (
    // Only an error interrupts; lifecycle and success banners are polite.
    <Alert
      variant={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      data-slot="notice"
      className={cn(action && 'items-center', className)}
    >
      {icon ?? <Icon aria-hidden="true" />}
      {title ? <AlertTitle className="text-sm leading-5 font-semibold">{title}</AlertTitle> : null}
      <AlertDescription className="text-[13px] leading-[19px]">{text}</AlertDescription>
      {action ? <AlertAction>{action}</AlertAction> : null}
    </Alert>
  );
}
