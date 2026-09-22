import type { ComponentType, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
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

export type FormSectionTag = { label: ReactNode; tone: 'required' | 'optional' };

/**
 * The heading of a full-page form section: indigo icon tile, title and
 * description, and a chip saying whether the section is required.
 */
export function FormSectionHeader({
  icon,
  title,
  description,
  tag,
  titleId,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tag?: FormSectionTag;
  titleId?: string;
}) {
  return (
    <div data-slot="form-section-header" className="flex w-full items-center gap-3.5">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-control bg-tint-indigo text-tint-indigo-foreground [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <h2 id={titleId} className="text-lg leading-6 font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="text-[13px] leading-[18px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {tag ? (
        <Badge size="sm" variant={tag.tone === 'required' ? 'danger' : 'neutral'}>
          {tag.label}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * One section of a full-page form as its own card. The id is the anchor the
 * section navigation scrolls to; `dimmed` renders a read-only section.
 */
export function FormSectionCard({
  id,
  icon,
  title,
  description,
  tag,
  dimmed = false,
  invalid = false,
  children,
  className,
}: {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tag?: FormSectionTag;
  dimmed?: boolean;
  /** Outlines a section that holds an error, so it is found at a glance. */
  invalid?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      // Focusable so the section navigation can hand keyboard focus over.
      tabIndex={-1}
      data-slot="form-section-card"
      className={cn(
        'flex scroll-mt-6 outline-none flex-col gap-5 rounded-card bg-card px-5 py-5.5 text-card-foreground md:px-7 md:py-6.5',
        invalid && 'ring-2 ring-destructive',
        dimmed &&
          'bg-card/70 text-muted-foreground [&_[data-slot=form-section-header]>span]:bg-secondary [&_[data-slot=form-section-header]>span]:text-muted-foreground',
        className,
      )}
    >
      <FormSectionHeader
        icon={icon}
        title={title}
        description={description}
        tag={tag}
        titleId={titleId}
      />
      {children}
    </section>
  );
}
