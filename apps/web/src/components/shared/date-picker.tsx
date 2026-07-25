'use client';

import { useState, type ReactNode } from 'react';
import type { Matcher } from 'react-day-picker';
import { differenceInCalendarDays, format as formatDate } from 'date-fns';
import { CalendarIcon, ClockIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  joinDateTimeInput,
  parseLocalInput,
  splitDateTimeInput,
  toLocalDateInput,
} from '@/lib/datetime';
import { useDateFnsLocale } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/**
 * Date and time controls, built on the shadcn Popover + Calendar recipe.
 *
 * Every picker speaks the same string shapes the native inputs used ("YYYY-MM-DD",
 * "HH:mm", "YYYY-MM-DDTHH:mm"), so form schemas and DTO mappers are unaffected by
 * the switch away from `<input type="date">`.
 *
 * shadcn deliberately has no time-picker component — its own date-and-time recipe
 * pairs the Calendar with a native `<input type="time">`, which is what
 * `TimePicker` wraps here (correct mobile keyboards, no bespoke spinner to
 * maintain).
 */

/** Optional bounds shared by the calendar-backed pickers. */
interface DateBounds {
  /** Days before this are not selectable. */
  fromDate?: Date;
  /** Days after this are not selectable. */
  toDate?: Date;
}

/**
 * Turns the bounds into react-day-picker matchers. Returns `undefined` when
 * unbounded — the matcher list must never contain an undefined edge.
 */
function boundsMatchers({ fromDate, toDate }: DateBounds): Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (fromDate) {
    matchers.push({ before: fromDate });
  }
  if (toDate) {
    matchers.push({ after: toDate });
  }
  return matchers.length > 0 ? matchers : undefined;
}

/**
 * The popover shell both calendar pickers share: an outline button that shows
 * the current value, an optional clear affordance, and the calendar itself.
 *
 * `PopoverTrigger asChild` must receive the *Button* as its direct child — it
 * injects the click handler, ref and `aria-expanded` onto whatever it wraps, so
 * a custom wrapper component in between silently swallows them and the popover
 * never opens.
 */
function CalendarPopover({
  id,
  open,
  onOpenChange,
  label,
  placeholder,
  disabled,
  invalid,
  onClear,
  clearLabel,
  children,
}: {
  id?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The formatted value, or `undefined` when nothing is picked. */
  label?: string;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  onClear?: () => void;
  clearLabel: string;
  /** The calendar rendered inside the popover. */
  children: ReactNode;
}) {
  const hasValue = Boolean(label);
  const showClear = hasValue && Boolean(onClear);

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn(
              'w-full justify-start font-normal',
              !hasValue && 'text-muted-foreground',
              showClear && 'pr-9',
            )}
          >
            <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">{hasValue ? label : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {children}
        </PopoverContent>
      </Popover>

      {/* A sibling of the trigger, not a child: nested buttons are invalid and
          would also toggle the popover. */}
      {showClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={clearLabel}
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          onClick={onClear}
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single date
// ---------------------------------------------------------------------------

export interface DatePickerProps extends DateBounds {
  id?: string;
  /** "YYYY-MM-DD", or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  clearable = false,
  fromDate,
  toDate,
}: DatePickerProps) {
  const t = useTranslations('datePicker');
  const locale = useDateFnsLocale();
  const [open, setOpen] = useState(false);
  const selected = parseLocalInput(value);

  return (
    <CalendarPopover
      id={id}
      open={open}
      onOpenChange={setOpen}
      label={selected ? formatDate(selected, 'PPP', { locale }) : undefined}
      placeholder={placeholder ?? t('pickDate')}
      disabled={disabled}
      invalid={invalid}
      onClear={clearable ? () => onChange('') : undefined}
      clearLabel={t('clear')}
    >
      <Calendar
        mode="single"
        locale={locale}
        selected={selected}
        defaultMonth={selected}
        disabled={boundsMatchers({ fromDate, toDate })}
        onSelect={(next) => {
          onChange(next ? toLocalDateInput(next) : '');
          setOpen(false);
        }}
        autoFocus
      />
    </CalendarPopover>
  );
}

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

export interface DateRangeValue {
  /** "YYYY-MM-DD", or "" when unset. */
  from: string;
  to: string;
}

/**
 * Which day the user just clicked, given the range react-day-picker produced.
 *
 * When a complete range is already selected, react-day-picker *extends* it
 * instead of starting over — so a single click can come back with both edges
 * filled. Diffing against the previous value recovers the actual click, which
 * lets a fresh click always begin a new range.
 */
function clickedEdge(previous: DateRangeValue, from?: Date, to?: Date): string {
  const nextFrom = from ? toLocalDateInput(from) : '';
  const nextTo = to ? toLocalDateInput(to) : '';
  if (nextFrom && nextFrom !== previous.from) {
    return nextFrom;
  }
  if (nextTo && nextTo !== previous.to) {
    return nextTo;
  }
  return nextFrom || nextTo;
}

export function DateRangePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  clearable = true,
  numberOfMonths = 2,
  fromDate,
  toDate,
}: DateBounds & {
  id?: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  numberOfMonths?: number;
}) {
  const t = useTranslations('datePicker');
  const locale = useDateFnsLocale();
  const [open, setOpen] = useState(false);
  // True between the first and the second click of one range selection. Owning
  // this phase is what keeps a single click from being read as a whole range.
  const [picking, setPicking] = useState(false);

  const from = parseLocalInput(value.from);
  const to = parseLocalInput(value.to);

  const label = from
    ? to
      ? `${formatDate(from, 'PP', { locale })} – ${formatDate(to, 'PP', { locale })}`
      : // Half-picked range: show the start and invite the end.
        `${formatDate(from, 'PP', { locale })} – …`
    : undefined;

  return (
    <CalendarPopover
      id={id}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Abandoning a half-made selection must not leave the phase stuck.
        setPicking(false);
      }}
      label={label}
      placeholder={placeholder ?? t('pickRange')}
      disabled={disabled}
      invalid={invalid}
      onClear={
        clearable
          ? () => {
              onChange({ from: '', to: '' });
              setPicking(false);
            }
          : undefined
      }
      clearLabel={t('clear')}
    >
      <Calendar
        mode="range"
        locale={locale}
        numberOfMonths={numberOfMonths}
        selected={from ? { from, to } : undefined}
        defaultMonth={from}
        disabled={boundsMatchers({ fromDate, toDate })}
        onSelect={(range) => {
          if (!picking) {
            // First click of a selection always starts a new range, even when a
            // complete one was already showing.
            onChange({ from: clickedEdge(value, range?.from, range?.to), to: '' });
            setPicking(true);
            return;
          }
          // Second click completes it.
          onChange({
            from: range?.from ? toLocalDateInput(range.from) : '',
            to: range?.to ? toLocalDateInput(range.to) : '',
          });
          setPicking(false);
          if (range?.from && range?.to) {
            setOpen(false);
          }
        }}
        autoFocus
      />
      {/* Tells the tutor how long the range is, and prompts for the missing
          end while only one edge is picked. */}
      <div className="text-muted-foreground border-t px-3 py-2 text-xs">
        {from && to
          ? t('nights', { count: differenceInCalendarDays(to, from) + 1 })
          : t('pickRangeEnd')}
      </div>
    </CalendarPopover>
  );
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/**
 * Local wall-clock time. A native time input on purpose: it brings the right
 * mobile keyboard, 12/24h per the user's own locale, and needs no bespoke
 * spinner — the same choice shadcn's date-and-time recipe makes.
 */
export function TimePicker({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  step,
  className,
}: {
  id?: string;
  /** "HH:mm". */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  step?: number;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <ClockIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        id={id}
        type="time"
        value={value}
        step={step}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date + time
// ---------------------------------------------------------------------------

/**
 * One instant, picked as a day plus a time. Two controls rather than a single
 * `datetime-local` input: the calendar makes choosing a day far easier, which
 * is exactly why shadcn composes it this way.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  clearable = false,
  /** The time used when a day is picked before any time is set. */
  defaultTime = '09:00',
  fromDate,
  toDate,
}: DateBounds & {
  id?: string;
  /** "YYYY-MM-DDTHH:mm", or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  defaultTime?: string;
}) {
  const { date, time } = splitDateTimeInput(value);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <DatePicker
        id={id}
        value={date}
        onChange={(nextDate) =>
          onChange(joinDateTimeInput(nextDate, time, defaultTime))
        }
        disabled={disabled}
        invalid={invalid}
        clearable={clearable}
        fromDate={fromDate}
        toDate={toDate}
      />
      <TimePicker
        value={time}
        onChange={(nextTime) =>
          onChange(joinDateTimeInput(date, nextTime, defaultTime))
        }
        // A time without a day is meaningless, so it waits for the date.
        disabled={disabled || !date}
        invalid={invalid}
        className="sm:w-40"
      />
    </div>
  );
}
