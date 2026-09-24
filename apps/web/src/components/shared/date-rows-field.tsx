'use client';

import { useId, type ReactNode } from 'react';
import { AlertCircleIcon, PlusIcon, XIcon } from 'lucide-react';
import type { Locale } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/shared/date-field';
import { IconButton } from '@/components/shared/icon-button';
import { TimeField, type TimeFieldLabels } from '@/components/shared/time-field';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type DateRow = {
  /** A stable key for the row, e.g. react-hook-form's field id. */
  key: string;
  /** "yyyy-MM-dd". */
  date: string;
  /** "HH:mm". */
  time: string;
};

export type DateRowsLabels = {
  /** The date column, "Дата". */
  date: string;
  /** The time column, "Початок". */
  time: string;
  /** "Додати дату". */
  add: string;
  /** The remove button of a row, e.g. "Прибрати чт, 1 жовтня". */
  remove: (index: number) => string;
  /** The date field's placeholder, "Оберіть дату". */
  pickDate: string;
  timeField: TimeFieldLabels;
  /** The phone time sheet's title for a row, "Початок · чт, 1 жовтня". */
  timeSheetTitle?: (index: number) => string;
};

/**
 * The dates of a lesson form, one row each: a date field, its own start
 * time and a round remove button (shown only while there is more than one
 * row), with the column labels above and «Додати дату» under them. Under a
 * row the caller may put a note (a past date, an overlap) or the row's
 * error. `fixed` is the edit form's single row, with no add or remove. On
 * phones the time column narrows to the compact time box.
 */
export function DateRowsField({
  rows,
  onDateChange,
  onTimeChange,
  onAdd,
  onRemove,
  onBlur,
  labels,
  formatDate,
  locale,
  notes = [],
  errors = [],
  busy = [],
  fixed = false,
  disabled = false,
  maxRows = 50,
}: {
  rows: DateRow[];
  onDateChange: (index: number, date: string) => void;
  onTimeChange: (index: number, time: string) => void;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onBlur?: () => void;
  labels: DateRowsLabels;
  /** Shows a picked date, "чт, 01.10.2026". */
  formatDate: (date: Date) => string;
  /** The calendar's locale, from date-fns. */
  locale?: Partial<Locale>;
  /** A note under each row, by index. */
  notes?: ReactNode[];
  /** Each row's error, by index. */
  errors?: ({ date?: string; time?: string } | undefined)[];
  /** Each row's busy slots for its time list, by index. */
  busy?: (Record<string, string> | undefined)[];
  fixed?: boolean;
  disabled?: boolean;
  /** The API books up to 50 dates at once. */
  maxRows?: number;
}) {
  const mobile = useIsMobile();
  const id = useId();
  const dateHeader = `${id}-date`;
  const timeHeader = `${id}-time`;
  const removable = !fixed && rows.length > 1;
  const timeWidth = mobile ? 'w-23' : 'w-33';

  return (
    <div data-slot="date-rows" className="flex flex-col gap-2.5">
      <div className="flex gap-2.5 text-sm leading-5 font-medium">
        <span id={dateHeader} className="min-w-0 flex-1">
          {labels.date}
        </span>
        <span id={timeHeader} className={cn('shrink-0', timeWidth)}>
          {labels.time}
        </span>
        {removable ? <span aria-hidden="true" className="w-11 shrink-0" /> : null}
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const error = errors[index];
          const message = error?.date ?? error?.time;
          const messageId = `${id}-${row.key}-message`;
          const dateId = `${id}-${row.key}-date`;
          const timeId = `${id}-${row.key}-time`;
          return (
            <li key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <DateField
                    id={dateId}
                    value={row.date}
                    onValueChange={(date) => onDateChange(index, date)}
                    onBlur={onBlur}
                    formatValue={formatDate}
                    placeholder={labels.pickDate}
                    locale={locale}
                    disabled={disabled}
                    invalid={Boolean(error?.date)}
                    aria-labelledby={`${dateHeader} ${dateId}`}
                    aria-describedby={message ? messageId : undefined}
                  />
                </div>
                <div className={cn('shrink-0', timeWidth)}>
                  <TimeField
                    id={timeId}
                    value={row.time}
                    onChange={(time) => onTimeChange(index, time)}
                    onBlur={onBlur}
                    compact={mobile}
                    disabled={disabled}
                    invalid={Boolean(error?.time)}
                    busy={busy[index]}
                    labels={{
                      ...labels.timeField,
                      sheetTitle: labels.timeSheetTitle?.(index) ?? labels.timeField.sheetTitle,
                    }}
                    aria-labelledby={timeHeader}
                    aria-describedby={message ? messageId : undefined}
                  />
                </div>
                {removable ? (
                  <IconButton
                    icon={<XIcon />}
                    label={labels.remove(index)}
                    size={44}
                    tone="paper"
                    className="mt-1 shrink-0"
                    disabled={disabled}
                    onClick={() => onRemove?.(index)}
                  />
                ) : null}
              </div>
              {message ? (
                <span
                  id={messageId}
                  role="alert"
                  className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-destructive"
                >
                  <AlertCircleIcon aria-hidden="true" className="size-3.5 shrink-0" />
                  {message}
                </span>
              ) : notes[index] ? (
                <div id={messageId}>{notes[index]}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {fixed || !onAdd ? null : (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || rows.length >= maxRows}
            onClick={onAdd}
          >
            <PlusIcon data-icon="inline-start" />
            {labels.add}
          </Button>
        </div>
      )}
    </div>
  );
}
