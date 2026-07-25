'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useWeekdayLabels, WEEKDAY_INDICES } from '@/lib/i18n/weekdays';

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
}: {
  id?: string;
  /** Selected weekday indices, 0 = Sunday … 6 = Saturday. */
  value: number[];
  onChange: (weekdays: number[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const labels = useWeekdayLabels();

  return (
    <ToggleGroup
      id={id}
      type="multiple"
      variant="outline"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      // Radix keeps values as strings; the form owns them as numbers.
      value={value.map(String)}
      onValueChange={(next) =>
        onChange(next.map(Number).sort((a, b) => a - b))
      }
      className="flex-wrap"
    >
      {WEEKDAY_INDICES.map((day) => (
        <ToggleGroupItem key={day} value={String(day)} className="w-12">
          {labels[day]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
