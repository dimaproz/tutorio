'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Node fills: a cancellation or a miss reads danger, a lesson that happened
// success, a change by a person sky, what the system did a quiet paper disc,
// and a structural event (created, makeup, attendance) the indigo tile.
const NODE_TONE = {
  danger: 'bg-tint-danger text-tint-danger-foreground',
  success: 'bg-tint-success text-tint-success-foreground',
  indigo: 'bg-tile-indigo text-tile-indigo-foreground',
  plain: 'bg-tint-sky text-tint-foreground',
  system: 'bg-secondary text-muted-foreground',
} as const;

export type TimelineTone = keyof typeof NODE_TONE;

export type TimelineItem = {
  id: string;
  icon: ReactNode;
  tone: TimelineTone;
  title: ReactNode;
  /** "9 вер · 10:12", already formatted by the caller. */
  time: string;
  /** Who and what changed: "«Present Perfect» → «Past Perfect»". */
  meta?: ReactNode;
};

/**
 * The history of one record as a vertical timeline: a 2px rail, 32px round
 * nodes in the event's tone, the title with its time on the right (wrapping
 * under the title when narrow) and a muted meta line. It shows the first
 * `visible` entries and a "show all · N more" toggle that expands in place
 * and ends the list with "collapse". With `fill` it takes the height its
 * parent gives it and only the list scrolls.
 */
export function LessonTimeline({
  items,
  visible = 3,
  defaultExpanded = false,
  showAllLabel,
  collapseLabel,
  fill = false,
  label,
  className,
}: {
  items: TimelineItem[];
  /** How many entries show before the list is expanded. */
  visible?: number;
  defaultExpanded?: boolean;
  /** "Show the whole history · 2 more", given the number hidden. */
  showAllLabel: (hidden: number) => string;
  collapseLabel: string;
  /** Fill the parent's height; the list scrolls inside it. */
  fill?: boolean;
  /** Accessible name of the list. */
  label?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hidden = Math.max(items.length - visible, 0);
  const shown = expanded ? items : items.slice(0, visible);

  return (
    <div
      data-slot="lesson-timeline"
      className={cn(
        'flex flex-col',
        fill && 'scrollbar-thin -mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-1',
        className,
      )}
    >
      <ol aria-label={label} className="flex flex-col">
        {shown.map((item, index) => {
          const last = index === shown.length - 1;
          return (
            <li key={item.id} className={cn('relative flex gap-3.5', !last && 'pb-4.5')}>
              {!last ? (
                <span
                  aria-hidden="true"
                  className="absolute top-8.5 -bottom-1.5 left-[15px] w-0.5 bg-border"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-pill [&_svg]:size-4',
                  NODE_TONE[item.tone],
                )}
              >
                {item.icon}
              </span>
              <div className="flex min-w-0 grow flex-col gap-0.5 pt-[5px]">
                <div className="flex flex-wrap justify-between gap-x-2.5">
                  <span className="text-sm leading-5 font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="tabular-nums text-xs leading-5 whitespace-nowrap text-muted-foreground">
                    {item.time}
                  </span>
                </div>
                {item.meta ? (
                  <span className="text-[13px] leading-[18px] text-muted-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {hidden > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 self-center"
        >
          {expanded ? (
            <ChevronUpIcon data-icon="inline-start" />
          ) : (
            <ChevronDownIcon data-icon="inline-start" />
          )}
          {expanded ? collapseLabel : showAllLabel(hidden)}
        </Button>
      ) : null}
    </div>
  );
}
