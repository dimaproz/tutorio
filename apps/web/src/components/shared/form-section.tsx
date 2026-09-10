import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type IconType = ComponentType<{ className?: string }>;

// A titled block for grouping related fields.
export function FormSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon: IconType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-3">
        <Icon className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm leading-snug font-medium">{title}</h3>
          {description ? (
            <p className="text-sm leading-normal text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
