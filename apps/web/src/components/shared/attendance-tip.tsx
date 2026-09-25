'use client';

import { useState, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** The colour of a line's dot: one colour per attendance mark everywhere. */
export type AttendanceTipTone = 'present' | 'absent' | 'excused' | 'muted';

/** What one attendance cell says: the lesson, who came or missed, and the context. */
export type AttendanceTipContent = {
  /** «Чт, 3 вер · Vocabulary: travel». */
  title: string;
  lines: { tone: AttendanceTipTone; text: string }[];
  /** «Пропуск 1 з 2 поспіль». */
  note?: string;
};

const DOT: Record<AttendanceTipTone, string> = {
  present: 'bg-success',
  absent: 'bg-danger-mark',
  excused: 'bg-hold-mark',
  muted: 'bg-background/50',
};

/**
 * One attendance cell with its tooltip (S08 decision 7): the lesson's date
 * and topic, a coloured dot per line — who came, who missed — and a quiet
 * context line. It opens on hover and focus, and on a tap on phones; the
 * open cell gets a ring. `className` draws the cell itself.
 */
export function AttendanceTip({
  tip,
  className,
  children,
}: {
  tip: AttendanceTipContent;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = [tip.title, ...tip.lines.map((line) => line.text), tip.note]
    .filter(Boolean)
    .join('. ');
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen(true)}
          className={cn(
            'outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1',
            'data-[state=delayed-open]:ring-2 data-[state=delayed-open]:ring-foreground data-[state=delayed-open]:ring-offset-1',
            'data-[state=instant-open]:ring-2 data-[state=instant-open]:ring-foreground data-[state=instant-open]:ring-offset-1',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="flex-col items-start gap-1 rounded-item px-3 py-2.5 text-left"
      >
        <span className="text-[13px] leading-[18px] font-semibold">{tip.title}</span>
        {tip.lines.map((line, index) => (
          <span key={index} className="flex items-center gap-1.5 text-xs leading-4">
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', DOT[line.tone])}
            />
            {line.text}
          </span>
        ))}
        {tip.note ? <span className="text-xs leading-4 text-background/70">{tip.note}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
