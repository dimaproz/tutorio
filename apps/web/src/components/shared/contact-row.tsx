import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One labelled contact value. `mono` is for figures a reader scans digit by
 * digit, such as a phone number.
 */
export function ContactRow({
  icon: Icon,
  children,
  mono = false,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="contact-row"
      className={cn('flex items-center gap-2.5 text-sm text-foreground', className)}
    >
      <Icon aria-hidden="true" className="size-4.5 shrink-0 text-muted-foreground" />
      <span className={cn('min-w-0 truncate', mono && 'font-mono text-[13px]')}>{children}</span>
    </div>
  );
}
