import { cn } from '@/lib/utils';

/** Uppercase group heading with a trailing rule, used inside long lists. */
export function SectionDivider({ label, className }: { label: string; className?: string }) {
  return (
    <div
      data-slot="section-divider"
      className={cn(
        'flex w-full items-center gap-3 text-xs leading-4 font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase',
        className,
      )}
    >
      {label}
      <span aria-hidden="true" className="h-px grow bg-border" />
    </div>
  );
}
