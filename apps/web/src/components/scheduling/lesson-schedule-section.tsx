'use client';

import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { CalendarClockIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { DurationInput } from '@/components/app/duration-input';
import { FormSection } from '@/components/app/form-section';
import { AppointmentField } from '@/components/shared';
import type { LessonFormValues } from '@/features/scheduling/model/lesson-form';
import { splitDateTimeInput } from '@/lib/datetime';
import { useBusySlots } from './use-busy-slots';

/**
 * When the lesson happens. One appointment field per date — a day and a free
 * slot in the same control — plus the "add another date" rows that book several
 * lessons in one go.
 */
export function LessonScheduleSection({ teacherId }: { teacherId: string }) {
  const t = useTranslations('scheduling.lessonForm');
  const form = useFormContext<LessonFormValues>();
  const { errors } = form.formState;
  const dates = useFieldArray({ control: form.control, name: 'startsAt' });

  const startsAt = useWatch({ control: form.control, name: 'startsAt' });
  const durationMin = useWatch({ control: form.control, name: 'durationMin' });

  const chosenDays = (startsAt ?? [])
    .map((entry) => splitDateTimeInput(entry.value ?? '').date)
    .filter(Boolean);
  const { isSlotUnavailable } = useBusySlots({
    teacherId,
    dates: chosenDays,
    durationMin: Number(durationMin) || 60,
  });

  return (
    <FormSection
      icon={CalendarClockIcon}
      title={t('schedule')}
      description={t('dateHint')}
      tone="warning"
    >
      <Field data-invalid={errors.startsAt ? true : undefined}>
        <FieldLabel>{t('date')}</FieldLabel>
        <div className="flex flex-col gap-2">
          {dates.fields.map((entry, index) => (
            <div key={entry.id} className="flex items-start gap-2">
              <Controller
                control={form.control}
                name={`startsAt.${index}.value` as const}
                render={({ field }) => (
                  <AppointmentField
                    id={index === 0 ? 'lesson-startsAt' : undefined}
                    value={field.value}
                    onChange={field.onChange}
                    isSlotUnavailable={isSlotUnavailable}
                    invalid={Boolean(errors.startsAt)}
                    clearable
                  />
                )}
              />
              {dates.fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => dates.remove(index)}
                  aria-label={t('removeDate')}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="neutral"
            size="sm"
            className="self-start"
            onClick={() => dates.append({ value: '' })}
          >
            <PlusIcon data-icon="inline-start" />
            {t('addDate')}
          </Button>
        </div>
        <FieldError errors={[errors.startsAt?.root ?? errors.startsAt]} />
      </Field>

      <Field data-invalid={errors.durationMin ? true : undefined}>
        <FieldLabel htmlFor="lesson-duration">{t('duration')}</FieldLabel>
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field }) => (
            <DurationInput
              id="lesson-duration"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              invalid={Boolean(errors.durationMin)}
            />
          )}
        />
        <FieldError errors={[errors.durationMin]} />
      </Field>
    </FormSection>
  );
}
