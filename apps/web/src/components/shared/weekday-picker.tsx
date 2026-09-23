'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useWeekdayLabels, WEEKDAY_INDICES } from '@/lib/i18n/weekdays';
import { cn } from '@/lib/utils';

/**
 * Picks the weekdays a recurring schedule repeats on.
 *
 * A multi-select `ToggleGroup` rather than a row of buttons: Radix gives the
 * roving-focus keyboard behaviour and pressed state for free, and the selection
 * reads as one control to assistive technology.
 */
export function WeekdayPicker({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  appearance = 'compact',
  'aria-labelledby': labelledBy,
}: {
  id?: string;
  /**
   * The id of the visible label. The picker is a group of toggles, which a
   * `<label for>` cannot name, so the label is referenced instead.
   */
  'aria-labelledby'?: string;
  /** Selected weekday indices, 0 = Sunday … 6 = Saturday. */
  value: number[];
  onChange: (weekdays: number[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * `compact` outlined toggles, `cards` with the long names, `pills` the
   * 44px Studio chips: indigo when on, a soft indigo tile when off.
   */
  appearance?: 'compact' | 'cards' | 'pills';
}) {
  const labels = useWeekdayLabels();
  const longLabels = useWeekdayLabels('long');
  // The week starts on Monday wherever the days are laid out as a row of cards or pills.
  const days = appearance === 'compact' ? WEEKDAY_INDICES : [1, 2, 3, 4, 5, 6, 0];

  return (
    <ToggleGroup
      id={id}
      aria-labelledby={labelledBy}
      type="multiple"
      variant={appearance === 'pills' ? 'default' : 'outline'}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      // Radix keeps values as strings; the form owns them as numbers.
      value={value.map(String)}
      onValueChange={(next) => onChange(next.map(Number).sort((a, b) => a - b))}
      className={cn(
        appearance === 'cards'
          ? 'grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7'
          : appearance === 'pills'
            ? 'flex-wrap gap-2'
            : 'flex-wrap',
      )}
    >
      {days.map((day) => (
        <ToggleGroupItem
          key={day}
          value={String(day)}
          className={cn(
            appearance === 'cards'
              ? 'h-20 w-full min-w-0 flex-col gap-1 border-2 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
              : appearance === 'pills'
                ? 'h-11 min-w-15 rounded-control bg-tile-indigo px-3 text-[13px] font-semibold tracking-[0.04em] text-tile-indigo-foreground uppercase hover:bg-tile-indigo hover:text-tile-indigo-foreground data-[state=on]:bg-brand data-[state=on]:text-brand-foreground md:min-w-16'
                : 'w-12',
          )}
        >
          {appearance === 'cards' ? (
            <>
              <span className="text-sm font-semibold">{labels[day]}</span>
              <span className="truncate text-[0.6875rem] opacity-70">{longLabels[day]}</span>
            </>
          ) : (
            labels[day]
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
