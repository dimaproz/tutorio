import { cn } from '@/lib/utils';

// Lab scaffolding only — never shipped to a product screen. Sections are
// divided by hairline rules rather than nested cards, so the lab reads as one
// ruled page instead of a grid of boxes.

export function LabSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-border flex flex-col gap-5 border-t pt-8', className)}>
      <div className="flex flex-col gap-1.5">
        <h2 className="workbook text-xl font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function LabBlock({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="register-label">{label}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Frames a demo on the page ground so surface colours can be judged. */
export function LabStage({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-background border-border overflow-hidden rounded-lg border',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
