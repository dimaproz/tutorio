'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { useNow } from 'next-intl';
import type { Locale } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fieldBoxClass } from '@/components/shared/text-field';
import { isCalendarDate, zonedDate, zonedDayStart } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { cn } from '@/lib/utils';

/**
 * "yyyy-MM-dd" → the picker's Date: the browser's midnight of that calendar
 * day, the only kind of day the picker grid knows. Never formatted.
 */
function toPickerDate(value: string): Date | undefined {
  if (!isCalendarDate(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

/** The picker's Date → "yyyy-MM-dd": its calendar day, as the grid showed it. */
function fromPickerDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A calendar date in the 52px field box of `TextField`: the trigger shows the
 * date as the caller formats it ("пт, 11.09.2026"), and a popover calendar
 * picks another. The value is a "yyyy-MM-dd" on the studio's calendar; the
 * caller's format gets the studio's midnight of that day, and the picker
 * marks the studio's today, wherever the browser is.
 */
export function DateField({
  id,
  value,
  onValueChange,
  formatValue,
  placeholder,
  locale,
  disabled = false,
  invalid = false,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  onBlur,
}: {
  id?: string;
  /** Names the calendar popover; defaults to the placeholder. */
  'aria-label'?: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Shows the picked date, e.g. with next-intl's formatter. */
  formatValue: (date: Date) => string;
  placeholder: string;
  /** The calendar's locale, from date-fns. */
  locale?: Partial<Locale>;
  disabled?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  /** Names the trigger from elsewhere, e.g. a column header of date rows. */
  'aria-labelledby'?: string;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const timeZone = useStudioTimeZone();
  const selected = toPickerDate(value);
  const today = toPickerDate(zonedDate(useNow(), timeZone));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-labelledby={labelledBy}
          data-placeholder={selected ? undefined : ''}
          className={cn(fieldBoxClass, 'justify-between font-normal hover:bg-card')}
        >
          <span className="truncate">
            {selected ? formatValue(zonedDayStart(value, timeZone)) : placeholder}
          </span>
          <CalendarIcon data-icon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      {/* The popover is a dialog: it needs a name, the field's own or its placeholder. */}
      <PopoverContent aria-label={ariaLabel ?? placeholder} className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? today}
          today={today}
          locale={locale}
          onSelect={(date) => {
            if (!date) return;
            onValueChange(fromPickerDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
