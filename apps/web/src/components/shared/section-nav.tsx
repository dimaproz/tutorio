'use client';

import type { MouseEvent, ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SectionNavStatus = 'done' | 'error' | 'none';

export type SectionNavItem = {
  /** The id of the section element the link scrolls to. */
  id: string;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: SectionNavStatus;
};

function scrollToSection(
  event: MouseEvent<HTMLAnchorElement>,
  id: string,
  onSelect?: (id: string) => void,
) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  // Move focus with the view so keyboard users continue from the section.
  target.focus({ preventScroll: true });
  onSelect?.(id);
}

function ErrorMark({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-pill bg-destructive font-bold text-destructive-foreground',
        small ? 'size-4 text-[11px]' : 'size-5 text-[13px]',
      )}
    >
      !
    </span>
  );
}

/**
 * The left navigation of a long form: one row per section with its icon tile,
 * title, description and completion state. Links are in-page anchors, so the
 * list also works as a table of contents without JavaScript.
 */
export function SectionNav({
  label,
  items,
  active,
  onSelect,
  errorLabel,
  doneLabel,
  note,
}: {
  label: string;
  items: SectionNavItem[];
  /** Id of the section currently in view. */
  active?: string;
  onSelect?: (id: string) => void;
  /** Accessible name of the error mark, e.g. "Has an error". */
  errorLabel: string;
  /** Accessible name of the done check, e.g. "Complete". */
  doneLabel: string;
  note?: ReactNode;
}) {
  return (
    <nav aria-label={label} data-slot="section-nav" className="flex w-full flex-col gap-1">
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={current ? 'true' : undefined}
            onClick={(event) => scrollToSection(event, item.id, onSelect)}
            className={cn(
              'flex items-center gap-3 rounded-field px-3 py-2.5 no-underline transition-[background-color,color,box-shadow] duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              current
                ? 'bg-card text-foreground shadow-hairline'
                : 'text-muted-foreground hover:bg-card/65 hover:text-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-[10px] [&_svg]:size-4',
                current
                  ? 'bg-tint-indigo text-tint-indigo-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              {item.icon}
            </span>
            <span className="flex min-w-0 grow flex-col">
              <span
                className={cn('text-sm leading-[19px]', current ? 'font-semibold' : 'font-medium')}
              >
                {item.title}
              </span>
              {item.description ? (
                <span className="truncate text-xs leading-4 text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
            {item.status === 'done' ? (
              <CheckIcon
                role="img"
                aria-label={doneLabel}
                strokeWidth={2.5}
                className="size-4 shrink-0 text-success"
              />
            ) : null}
            {item.status === 'error' ? <ErrorMark label={errorLabel} /> : null}
          </a>
        );
      })}
      {note ? (
        <p className="mx-3 mt-2 text-xs leading-[17px] text-muted-foreground">{note}</p>
      ) : null}
    </nav>
  );
}

/**
 * The same navigation as a horizontally scrolling chip row, for phones.
 */
export function SectionChips({
  label,
  items,
  active,
  onSelect,
  errorLabel,
  doneLabel,
  className,
}: {
  label: string;
  items: Pick<SectionNavItem, 'id' | 'title' | 'status'>[];
  active?: string;
  onSelect?: (id: string) => void;
  errorLabel: string;
  doneLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-slot="section-chips"
      className={cn('no-scrollbar flex w-full gap-2 overflow-x-auto', className)}
    >
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={current ? 'true' : undefined}
            onClick={(event) => scrollToSection(event, item.id, onSelect)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-medium no-underline transition-[background-color,border-color,color] duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              current
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:border-line-hover hover:text-foreground',
            )}
          >
            {item.title}
            {item.status === 'done' ? (
              <CheckIcon
                role="img"
                aria-label={doneLabel}
                strokeWidth={2.5}
                className="size-3.5 shrink-0"
              />
            ) : null}
            {item.status === 'error' ? <ErrorMark label={errorLabel} small /> : null}
          </a>
        );
      })}
    </nav>
  );
}
