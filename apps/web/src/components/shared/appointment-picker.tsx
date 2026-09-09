'use client';

import { useMemo, useState } from 'react';
import { format as formatDate } from 'date-fns';
import { CalendarClockIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  buildTimeSlots,
  joinDateTimeInput,
  parseLocalInput,
  splitDateTimeInput,
  toLocalDateInput,
  type TimeSlotRange,
} from '@/lib/datetime';
import { useDateFnsLocale } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/** Working hours the slot column offers by default. */
const DEFAULT_SLOTS: TimeSlotRange = { from: '08:00', to: '20:00', stepMin: 30 };

/** What both the inline picker and the field variant need to know. */
interface AppointmentBaseProps {
  /** "YYYY-MM-DDTHH:mm", or "" when nothing is booked yet. */
  value: string;
  onChange: (value: string) => void;
  slots?: TimeSlotRange;
  /** Called per slot of the selected day; `true` renders it disabled. */
  isSlotUnavailable?: (date: string, time: string) => boolean;
  disabled?: boolean;
  invalid?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * The day-and-slots body: a month on the left, that day's bookable times on the
 * right. Shared by the inline picker and the popover field so the two can never
 * drift apart.
 */
function AppointmentPanel({
  value,
  onChange,
  slots = DEFAULT_SLOTS,
  isSlotUnavailable,
  fromDate,
  toDate,
  onComplete,
}: AppointmentBaseProps & {
  /** Called once a day *and* a time are both chosen (the field closes on this). */
  onComplete?: () => void;
}) {
  const t = useTranslations('datePicker');
  const locale = useDateFnsLocale();

  const { date, time } = splitDateTimeInput(value);
  const selected = parseLocalInput(date);
  const times = useMemo(() => buildTimeSlots(slots), [slots]);

  const bounds = [
    ...(fromDate ? [{ before: fromDate }] : []),
    ...(toDate ? [{ after: toDate }] : []),
  ];

  return (
    <div className="flex max-sm:flex-col">
      <Calendar
        mode="single"
        locale={locale}
        selected={selected}
        defaultMonth={selected}
        disabled={bounds.length > 0 ? bounds : undefined}
        onSelect={(next) => {
          if (!next) {
            onChange('');
            return;
          }
          // Changing the day keeps the chosen time, so moving a booking by a
          // day does not throw the slot away.
          onChange(joinDateTimeInput(toLocalDateInput(next), time, ''));
        }}
        className="p-3 sm:pe-4"
      />

      <div className="relative w-full border-t sm:w-44 sm:border-t-0 sm:border-s">
        {selected ? (
          <ScrollArea className="h-52 sm:h-[19rem]">
            <div className="flex flex-col gap-3 p-3">
              <p className="text-sm font-medium">
                {formatDate(selected, 'EEEE, d MMM', { locale })}
              </p>
              <div className="grid gap-1.5 max-sm:grid-cols-3">
                {times.map((slot) => {
                  const unavailable = isSlotUnavailable?.(date, slot) ?? false;
                  return (
                    <Button
                      key={slot}
                      type="button"
                      size="sm"
                      variant={time === slot ? 'default' : 'outline'}
                      disabled={unavailable}
                      aria-pressed={time === slot}
                      className="tabular w-full"
                      onClick={() => {
                        onChange(joinDateTimeInput(date, slot, ''));
                        onComplete?.();
                      }}
                    >
                      {slot}
                    </Button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        ) : (
          // No day yet: say so instead of listing times that go nowhere.
          <p className="text-muted-foreground p-4 text-sm">{t('pickDateFirst')}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Booking one appointment, always visible. Use when the choice *is* the screen —
 * a booking step or a dedicated panel.
 */
export function AppointmentPicker({
  className,
  ...props
}: AppointmentBaseProps & { className?: string }) {
  return (
    <div
      className={cn(
        'bg-card overflow-hidden rounded-xl border',
        props.invalid && 'border-destructive',
        props.disabled && 'pointer-events-none opacity-60',
        className,
      )}
      aria-disabled={props.disabled || undefined}
    >
      <AppointmentPanel {...props} />
    </div>
  );
}

/**
 * The same booking UI as a form field: a compact trigger that opens the day and
 * slot panel. Use inside a form, where a permanently expanded calendar would
 * dominate the layout.
 */
export function AppointmentField({
  id,
  placeholder,
  clearable = false,
  ...props
}: AppointmentBaseProps & {
  id?: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const t = useTranslations('datePicker');
  const locale = useDateFnsLocale();
  const [open, setOpen] = useState(false);

  const { date, time } = splitDateTimeInput(props.value);
  const selected = parseLocalInput(date);
  // Only a day *and* a time make a real appointment.
  const label =
    selected && time
      ? `${formatDate(selected, 'PP', { locale })}, ${time}`
      : selected
        ? `${formatDate(selected, 'PP', { locale })} · ${t('pickTime')}`
        : undefined;

  const showClear = Boolean(label) && clearable;

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={props.disabled}
            aria-invalid={props.invalid || undefined}
            className={cn(
              'w-full justify-start font-normal',
              !label && 'text-muted-foreground',
              showClear && 'pr-9',
            )}
          >
            <CalendarClockIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">{label ?? placeholder ?? t('pickSlot')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <AppointmentPanel {...props} onComplete={() => setOpen(false)} />
        </PopoverContent>
      </Popover>

      {showClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={props.disabled}
          aria-label={t('clear')}
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          onClick={() => props.onChange('')}
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
