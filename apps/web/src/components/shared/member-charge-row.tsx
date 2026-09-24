import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// One colour per attendance mark everywhere (present, absent, excused,
// paused); the same tones carry a package note ("running out").
const NOTE_TONE = {
  success: 'text-tint-success-foreground',
  danger: 'text-tint-danger-foreground',
  info: 'text-tint-info-foreground',
  warning: 'text-tint-warning-foreground',
  muted: 'text-muted-foreground',
} as const;

export type MemberNoteTone = keyof typeof NOTE_TONE;

/**
 * One group member on a lesson: avatar, name, a coloured line under the name
 * (the attendance mark, or a note such as "package running out") and the
 * charge badge. On desktop the badge sits on the trailing edge; `stacked`
 * (phones) puts it under the name beside the line.
 */
export function MemberChargeRow({
  media,
  name,
  note,
  badge,
  stacked = false,
  className,
}: {
  media: ReactNode;
  name: ReactNode;
  note?: { label: ReactNode; tone: MemberNoteTone };
  /** The charge badge, e.g. "Charged · 3 left" or "On pause". */
  badge?: ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  const noteNode = note ? (
    <span className={cn('text-[13px] leading-[18px]', NOTE_TONE[note.tone])}>{note.label}</span>
  ) : null;

  return (
    <div
      data-slot="member-charge-row"
      className={cn('flex min-h-14 items-center gap-3 py-1.5', className)}
    >
      {media}
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-[15px] leading-5 text-foreground">{name}</span>
        {stacked ? (
          noteNode || badge ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {noteNode}
              {badge}
            </div>
          ) : null
        ) : (
          noteNode
        )}
      </div>
      {!stacked && badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}
