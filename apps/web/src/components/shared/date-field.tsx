'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import type { Locale } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fieldBoxClass } from '@/components/shared/text-field';
import { cn } from '@/lib/utils';

/** "yyyy-MM-dd" → a local midnight Date, or undefined when blank. */
function toDate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

/** A local Date → "yyyy-MM-dd". */
function toValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A calendar date in the 52px field box of `TextField`: the trigger shows the
 * date as the caller formats it ("пт, 11.09.2026"), and a popover calendar
 * picks another. The value is the "yyyy-MM-dd" of the browser's wall clock,
 * like a native date input.
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
  onBlur,
}: {
  id?: string;
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
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

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
          data-placeholder={selected ? undefined : ''}
          className={cn(fieldBoxClass, 'justify-between font-normal hover:bg-card')}
        >
          <span className="truncate">{selected ? formatValue(selected) : placeholder}</span>
          <CalendarIcon data-icon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          locale={locale}
          onSelect={(date) => {
            if (!date) return;
            onValueChange(toValue(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
