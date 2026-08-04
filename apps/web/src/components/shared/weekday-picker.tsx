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
}: {
  id?: string;
  /** Selected weekday indices, 0 = Sunday … 6 = Saturday. */
  value: number[];
  onChange: (weekdays: number[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  appearance?: 'compact' | 'cards';
}) {
  const labels = useWeekdayLabels();
  const longLabels = useWeekdayLabels('long');
  const days = appearance === 'cards' ? [1, 2, 3, 4, 5, 6, 0] : WEEKDAY_INDICES;

  return (
    <ToggleGroup
      id={id}
      type="multiple"
      variant="outline"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      // Radix keeps values as strings; the form owns them as numbers.
      value={value.map(String)}
      onValueChange={(next) => onChange(next.map(Number).sort((a, b) => a - b))}
      className={cn(
        appearance === 'cards'
          ? 'grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7'
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
              : 'w-12',
          )}
        >
          {appearance === 'cards' ? (
            <>
              <span className="font-heading text-sm font-semibold">{labels[day]}</span>
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
