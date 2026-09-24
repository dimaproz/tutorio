import type { ReactNode } from 'react';
import { RingsArt } from '@/components/shared/rings-art';
import { cn } from '@/lib/utils';

/**
 * The indigo band that heads the lesson windows (S01 layout A, the S02
 * form): `tint-indigo` with the brand rings clipped in the top-right corner.
 * The caller owns what it holds; `BandHeader` is the forms' first row.
 */
export function TintBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="tint-band"
      className={cn(
        'relative isolate flex shrink-0 flex-col gap-4.5 overflow-hidden bg-tint-indigo p-6 text-tint-foreground',
        className,
      )}
    >
      <RingsArt className="-top-7.5 -right-7.5 -z-10 text-brand opacity-16" />
      {children}
    </div>
  );
}

/**
 * A form's head inside the band: a white icon tile (hidden on phones), the
 * title and a subtitle, and the round actions on the right — close last, as
 * on every window. `title` is the caller's dialog title element.
 */
export function BandHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      {icon ? (
        <span
          aria-hidden="true"
          className="hidden size-11 shrink-0 items-center justify-center rounded-item bg-card text-brand md:flex [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 grow flex-col gap-0.5">
        {title}
        {subtitle ? (
          <div className="text-sm leading-[19px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
