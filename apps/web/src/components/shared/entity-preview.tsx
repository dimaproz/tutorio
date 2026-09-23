import type { ReactNode } from 'react';

/**
 * A small indigo summary of a record: eyebrow, avatar, name, status chip and
 * a white panel of rows, or an explanation when there is nothing to show yet.
 */
export function EntityPreview({
  heading,
  avatar,
  name,
  status,
  rows,
  emptyText,
}: {
  heading: ReactNode;
  avatar: ReactNode;
  name: ReactNode;
  /** Status chip, typically a dotted Badge. */
  status?: ReactNode;
  /** Rows, typically `ContactRow`s. */
  rows?: ReactNode;
  emptyText?: ReactNode;
}) {
  return (
    <aside
      data-slot="entity-preview"
      className="flex w-full flex-col gap-4 rounded-card bg-tint-indigo p-5.5 text-tint-foreground"
    >
      <span className="text-xs leading-4 font-medium tracking-[0.04em] text-tint-indigo-foreground uppercase">
        {heading}
      </span>
      <div className="flex items-center gap-3.5">
        {avatar}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-[17px] leading-[22px] font-semibold tracking-[-0.01em]">
            {name}
          </span>
          {status}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 rounded-row bg-card p-4 text-foreground">
        {rows ?? (
          <span className="text-[13px] leading-[18px] text-muted-foreground">{emptyText}</span>
        )}
      </div>
    </aside>
  );
}
