import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { sectionToneClass, type SectionTone } from './section-tone';

type IconType = ComponentType<{ className?: string }>;

// A titled block for grouping related fields inside a form — a tinted icon
// square, a heading and an optional description, followed by the fields. The
// form voice that mirrors the detail view's SectionTitle so create/edit and
// read views feel like one product. Reused across every entity form.
export function FormSection({
  icon: Icon,
  title,
  description,
  action,
  tone = 'indigo',
  children,
  className,
}: {
  icon: IconType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: SectionTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            sectionToneClass[tone],
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-heading text-sm leading-snug font-medium">{title}</h3>
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
