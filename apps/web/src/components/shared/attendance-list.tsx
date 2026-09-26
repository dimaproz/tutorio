import type { ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { AttendanceTip, type AttendanceTipContent } from '@/components/shared/attendance-tip';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export type AttendanceCellState = 'present' | 'absent' | 'excused' | 'cancelled' | 'unmarked';

export type AttendanceRowTone = 'plain' | 'risk' | 'hold';

export type AttendanceListRow = {
  id: string;
  name: string;
  /** Phone label, e.g. "Артем Л.". */
  shortName?: string;
  avatarKey?: string | null;
  /** One cell per window lesson, oldest first. */
  cells: AttendanceCellState[];
  /** "88%", or "—" for a participant on hold. */
  rate: string;
  /** "2 absences in a row · last came 16.09". */
  note: string;
  /** Spoken summary of the cells, e.g. "Came to 5 of 6". */
  cellsLabel: string;
  /** One tooltip per cell (the date, the topic, came or missed); none keeps the cells still. */
  tips?: AttendanceTipContent[];
  tone?: AttendanceRowTone;
};

export type AttendanceListStats = {
  lessons: { label: string; value: ReactNode; note: string };
  rate: { label: string; value: ReactNode; note: string; good?: boolean };
  misses: { label: string; value: ReactNode; note: string; warn?: boolean };
  cancelled: {
    label: string;
    value: ReactNode;
    charged: { value: ReactNode; label: string };
    free: { value: ReactNode; label: string };
  };
};

const CELL_CLASS: Record<AttendanceCellState, string> = {
  present: 'bg-success',
  absent: 'bg-danger-mark',
  excused: 'bg-hold-mark',
  // A cancelled lesson is grey for everyone: nobody missed it.
  cancelled: 'bg-stat-track',
  unmarked: 'border border-dashed border-line-hover',
};

const ROW_CLASS: Record<AttendanceRowTone, { row: string; note: string; rate: string }> = {
  plain: { row: '', note: 'text-muted-foreground', rate: 'text-foreground' },
  risk: {
    row: 'bg-tint-danger',
    note: 'text-tint-danger-foreground',
    rate: 'text-tint-danger-foreground',
  },
  // Paused means grey (S08 decision 5), as on the member's roster card.
  hold: {
    row: 'bg-secondary',
    note: 'text-muted-foreground',
    rate: 'text-muted-foreground',
  },
};

function Tile({
  label,
  value,
  children,
  tone = 'plain',
}: {
  label: string;
  value: ReactNode;
  children: ReactNode;
  tone?: 'plain' | 'warn' | 'good';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-item px-3.5 py-3',
        tone === 'warn'
          ? 'bg-tint-warning text-tint-foreground'
          : tone === 'good'
            ? 'bg-tint-success text-tint-foreground'
            : 'bg-background',
      )}
    >
      <span className="truncate text-xs leading-4 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-[22px] leading-[26px] font-semibold tracking-[-0.01em] tabular-nums',
          tone === 'warn' && 'text-tint-warning-foreground',
        )}
      >
        {value}
      </span>
      {children}
    </div>
  );
}

/**
 * Attendance over a group's last held lessons: four tiles over one row per
 * participant, each with a strip of lesson cells and a rate. The rules are
 * the caller's (a cancelled lesson is grey for everyone, a participant on
 * hold has no rate, "at risk" is two absences in a row); this renders them.
 * On phones it shows the rate and misses tiles and the first rows, with a
 * command that reveals the rest. No copy of its own.
 */
export function AttendanceList({
  title,
  windowLabel,
  stats,
  rows,
  visibleRows,
  onShowAll,
  showAllLabel,
  compact = false,
  empty,
  className,
}: {
  title: string;
  /** "Last 8 lessons". */
  windowLabel: string;
  stats: AttendanceListStats;
  /** Worst first. */
  rows: AttendanceListRow[];
  /** Phones: how many rows show before "show all". */
  visibleRows?: number;
  onShowAll?: () => void;
  /** "All 6 students". */
  showAllLabel?: string;
  compact?: boolean;
  /** Rendered under the header when there is nothing to summarize yet. */
  empty?: ReactNode;
  className?: string;
}) {
  const shownRows = visibleRows === undefined ? rows : rows.slice(0, visibleRows);
  const hidden = rows.length - shownRows.length;

  const rateTile = (
    <Tile
      label={stats.rate.label}
      value={stats.rate.value}
      tone={stats.rate.good ? 'good' : 'plain'}
    >
      <span className="truncate text-[11px] leading-[15px] text-muted-foreground">
        {stats.rate.note}
      </span>
    </Tile>
  );
  const missesTile = (
    <Tile
      label={stats.misses.label}
      value={stats.misses.value}
      tone={stats.misses.warn ? 'warn' : 'plain'}
    >
      <span className="truncate text-[11px] leading-[15px] text-muted-foreground">
        {stats.misses.note}
      </span>
    </Tile>
  );

  return (
    <Card data-slot="attendance-list" className={cn('gap-3 px-4 py-5 md:px-6', className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-[13px] text-muted-foreground">{windowLabel}</span>
      </div>

      {empty ?? (
        <div className="flex flex-col gap-3.5">
          {compact ? (
            <div className="grid grid-cols-2 gap-2">
              {rateTile}
              {missesTile}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_1.3fr] gap-2">
              <Tile label={stats.lessons.label} value={stats.lessons.value}>
                <span className="truncate text-[11px] leading-[15px] text-muted-foreground">
                  {stats.lessons.note}
                </span>
              </Tile>
              {rateTile}
              {missesTile}
              <Tile label={stats.cancelled.label} value={stats.cancelled.value}>
                <span className="flex min-w-0 items-baseline gap-2.5 text-[11px] leading-[15px]">
                  {[stats.cancelled.charged, stats.cancelled.free].map((part, index) => (
                    <span key={index} className="flex min-w-0 items-baseline gap-1">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-border">
                          ·
                        </span>
                      ) : null}
                      <span className="tabular-nums text-xs font-semibold">{part.value}</span>
                      <span className="truncate text-muted-foreground">{part.label}</span>
                    </span>
                  ))}
                </span>
              </Tile>
            </div>
          )}

          {rows.length > 0 ? (
            <>
              <Separator />
              <ul className="flex flex-col gap-1">
                {shownRows.map((row) => {
                  const tone = ROW_CLASS[row.tone ?? 'plain'];
                  return (
                    <li
                      key={row.id}
                      className={cn('flex items-center gap-3 rounded-item p-2', tone.row)}
                    >
                      <EntityAvatar
                        avatarKey={row.avatarKey}
                        fullName={row.name}
                        className="size-8"
                      />
                      <span className="flex min-w-0 grow flex-col gap-px">
                        <span className="truncate text-sm leading-[19px] font-semibold">
                          {compact && row.shortName ? row.shortName : row.name}
                        </span>
                        <span className={cn('truncate text-xs leading-4', tone.note)}>
                          {row.note}
                        </span>
                      </span>
                      {row.tips ? (
                        <span
                          role="group"
                          aria-label={row.cellsLabel}
                          className="flex shrink-0 items-center gap-[3px]"
                        >
                          {row.cells.map((cell, index) => {
                            const tip = row.tips?.[index];
                            const cellClass = cn('h-4.5 w-2.5 rounded-[3px]', CELL_CLASS[cell]);
                            return tip ? (
                              // Cells are positional samples of one window.
                              <AttendanceTip key={index} tip={tip} className={cellClass} />
                            ) : (
                              <span key={index} className={cellClass} />
                            );
                          })}
                        </span>
                      ) : (
                        <span
                          role="img"
                          aria-label={row.cellsLabel}
                          className="flex shrink-0 items-center gap-[3px]"
                        >
                          {row.cells.map((cell, index) => (
                            <span
                              // Cells are positional samples of one window.
                              key={index}
                              className={cn('h-4.5 w-2.5 rounded-[3px]', CELL_CLASS[cell])}
                            />
                          ))}
                        </span>
                      )}
                      <span
                        className={cn(
                          'w-12 shrink-0 text-right tabular-nums text-[13px] font-semibold',
                          tone.rate,
                        )}
                      >
                        {row.rate}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {hidden > 0 && onShowAll ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onShowAll}
                  className="self-center max-md:h-11"
                >
                  <ChevronDownIcon data-icon="inline-start" />
                  {showAllLabel}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}
