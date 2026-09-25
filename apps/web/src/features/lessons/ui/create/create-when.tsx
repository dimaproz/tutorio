'use client';

import { useId, type ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { DateField } from '@/components/shared/date-field';
import { DateRowsField } from '@/components/shared/date-rows-field';
import { FieldNote } from '@/components/shared/field-note';
import { Segmented } from '@/components/shared/segmented';
import { FieldFrame } from '@/components/shared/text-field';
import { TimeField, timeSteps } from '@/components/shared/time-field';
import { WeekdayPicker } from '@/components/shared/weekday-picker';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { capitalizeFirst } from '@/lib/utils';
import {
  busySlots,
  localInstant,
  overlapping,
  type BusyLesson,
  type BusyScope,
} from '../../model/busy';
import { pastRows, weekAfter, type CreateFormValues } from '../../model/create';
import { useDateRowsLabels, useFormDates, useTimeLabels } from '../field-labels';
import { WhenHeading } from '../lesson-form-kit';
import { useLessonDates } from '../lesson-format';

const STEPS = timeSteps(15);

/** The one-off dates: a row per date with its own time, busy slots and notes. */
function OnceDates({
  lessons,
  scope,
  now,
}: {
  lessons: readonly BusyLesson[];
  scope: BusyScope;
  now: number;
}) {
  const t = useTranslations('lessons.fields');
  const form = useFormContext<CreateFormValues>();
  const rows = useFieldArray({ control: form.control, name: 'dates' });
  const [dates, durationMin] = useWatch({ control: form.control, name: ['dates', 'durationMin'] });
  const formDates = useFormDates();
  const lessonDates = useLessonDates();
  const labels = useDateRowsLabels(dates.map((row) => row.date));
  const minutes = Number(durationMin);
  const timeZone = useStudioTimeZone();
  const past = pastRows({ dates }, now, timeZone);
  const errors = form.formState.errors.dates;
  const validate = form.formState.isSubmitted;

  const notes = dates.map((row, index) => {
    if (past[index]) {
      return (
        <Badge key="past" variant="warning" dot>
          {t('pastDate')}
        </Badge>
      );
    }
    if (!row.date || !/^\d{2}:\d{2}$/.test(row.time)) return null;
    const hit = overlapping(lessons, scope, localInstant(row.date, row.time, timeZone), minutes)[0];
    if (!hit) return null;
    const range = `${lessonDates.time(hit.startsAtUtc)}–${lessonDates.endTime(hit)}`;
    return (
      <FieldNote key="overlap" tone="warning" icon={<TriangleAlertIcon />}>
        {t('overlap', { name: hit.group?.name ?? hit.student?.fullName ?? '', time: range })}
      </FieldNote>
    );
  });

  return (
    <DateRowsField
      rows={rows.fields.map((field, index) => ({
        key: field.id,
        date: dates[index]?.date ?? '',
        time: dates[index]?.time ?? '',
      }))}
      labels={labels}
      formatDate={formDates.field}
      locale={formDates.locale}
      onDateChange={(index, date) =>
        form.setValue(`dates.${index}.date`, date, { shouldDirty: true, shouldValidate: validate })
      }
      onTimeChange={(index, time) =>
        form.setValue(`dates.${index}.time`, time, { shouldDirty: true, shouldValidate: validate })
      }
      onAdd={() => {
        const last = dates.at(-1);
        rows.append({ date: last ? weekAfter(last.date) : '', time: last?.time ?? '' });
      }}
      onRemove={(index) => rows.remove(index)}
      busy={dates.map((row) => busySlots(lessons, scope, row.date, STEPS, timeZone))}
      notes={notes}
      errors={dates.map((_, index) => ({
        date: errors?.[index]?.date?.message,
        time: errors?.[index]?.time?.message,
      }))}
    />
  );
}

/**
 * «Щотижня»: the weekday pills across the width, a start time per picked day
 * in two columns, «З» and the optional «До» (hidden when the days are added
 * to an existing schedule: a change keeps the schedule's end). The schedule
 * forms (S05) put their length and horizon `between` the times and the
 * dates, name the dates their own way, or leave the dates out.
 */
export function WeeklyBlock({
  addToExisting = false,
  between,
  dates = true,
  labels,
}: {
  addToExisting?: boolean;
  between?: ReactNode;
  dates?: boolean;
  labels?: { from: string; until: string; untilHint?: string };
}) {
  const t = useTranslations('lessons.create');
  const tFields = useTranslations('lessons.fields');
  const form = useFormContext<CreateFormValues>();
  const [weekdays, times, from, until] = useWatch({
    control: form.control,
    name: ['weekdays', 'times', 'from', 'until'],
  });
  const longDays = useWeekdayLabels('long');
  const timeLabels = useTimeLabels();
  const formDates = useFormDates();
  const daysId = useId();
  const errors = form.formState.errors;
  const validate = form.formState.isSubmitted;
  const ordered = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

  const dateField = (
    name: 'from' | 'until',
    value: string,
    label: string,
    hint?: string,
    error?: string,
  ) => (
    <FieldFrame label={label} hint={hint} error={error}>
      {(a11y) => (
        <DateField
          id={a11y.id}
          aria-describedby={a11y.describedBy}
          invalid={Boolean(a11y.invalid)}
          value={value}
          onValueChange={(next) =>
            form.setValue(name, next, { shouldDirty: true, shouldValidate: validate })
          }
          formatValue={formDates.field}
          placeholder={tFields('pickDate')}
          locale={formDates.locale}
        />
      )}
    </FieldFrame>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id={daysId} className="text-sm leading-5 font-medium">
          {t('days')}
        </span>
        <WeekdayPicker
          aria-labelledby={daysId}
          appearance="pills"
          fill
          value={weekdays}
          invalid={Boolean(errors.weekdays)}
          onChange={(next) => {
            const nextTimes = { ...form.getValues('times') };
            const fallback =
              Object.values(nextTimes).find(Boolean) ?? form.getValues('dates.0.time');
            for (const day of next) nextTimes[String(day)] ??= fallback ?? '';
            form.setValue('times', nextTimes);
            form.setValue('weekdays', next, { shouldDirty: true, shouldValidate: validate });
          }}
        />
        {errors.weekdays?.message ? (
          <span role="alert" className="text-[13px] leading-[18px] font-medium text-destructive">
            {errors.weekdays.message}
          </span>
        ) : null}
      </div>
      {ordered.length > 0 ? (
        <div className="grid grid-cols-2 items-start gap-3">
          {ordered.map((day) => (
            <FieldFrame
              key={day}
              label={capitalizeFirst(longDays[day] ?? '')}
              error={errors.times?.[String(day)]?.message}
            >
              {(a11y) => (
                <TimeField
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={Boolean(a11y.invalid)}
                  value={times[String(day)] ?? ''}
                  onChange={(next) =>
                    form.setValue(`times.${String(day)}`, next, {
                      shouldDirty: true,
                      shouldValidate: validate,
                    })
                  }
                  labels={{ ...timeLabels, sheetTitle: capitalizeFirst(longDays[day] ?? '') }}
                />
              )}
            </FieldFrame>
          ))}
        </div>
      ) : null}
      {between}
      {dates ? (
        <div className="grid grid-cols-2 items-start gap-3">
          {dateField('from', from, labels?.from ?? t('from'), undefined, errors.from?.message)}
          {addToExisting
            ? null
            : dateField(
                'until',
                until,
                labels?.until ?? t('until'),
                labels?.untilHint ?? t('untilHint'),
                errors.until?.message,
              )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * «Коли»: the overline with «Разово / Щотижня» on the right, then the date
 * rows or the weekly block.
 */
export function CreateWhen({
  lessons,
  scope,
  now,
  addToExisting,
}: {
  lessons: readonly BusyLesson[];
  scope: BusyScope;
  now: number;
  addToExisting: boolean;
}) {
  const t = useTranslations('lessons.create');
  const form = useFormContext<CreateFormValues>();
  const frequency = useWatch({ control: form.control, name: 'frequency' });
  return (
    <section className="flex flex-col gap-3.5">
      <WhenHeading
        title={t('when')}
        aside={
          <Segmented
            variant="paper"
            label={t('frequency')}
            value={frequency}
            onValueChange={(next) => {
              if (next === 'weekly' && !form.getValues('from')) {
                form.setValue('from', form.getValues('dates.0.date'));
              }
              form.setValue('frequency', next, { shouldDirty: true });
            }}
            items={[
              { value: 'once', label: t('once') },
              { value: 'weekly', label: t('weekly') },
            ]}
          />
        }
      />
      {frequency === 'once' ? (
        <OnceDates lessons={lessons} scope={scope} now={now} />
      ) : (
        <WeeklyBlock addToExisting={addToExisting} />
      )}
    </section>
  );
}
