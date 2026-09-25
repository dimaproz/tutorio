'use client';

import { BanknoteIcon, CalendarPlusIcon, GiftIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { DateRowsField } from '@/components/shared/date-rows-field';
import { DurationField } from '@/components/shared/duration-field';
import { Notice } from '@/components/shared/notice';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { timeSteps } from '@/components/shared/time-field';
import { zonedIso } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useCreateMakeupMutation } from '../../api';
import {
  makeupDto,
  makeupFormDefaults,
  makeupFormSchema,
  makeupWillBeFree,
  type MakeupFormValues,
} from '../../model/makeup';
import { busySlots, localInstant } from '../../model/busy';
import {
  useDateRowsLabels,
  useDurationHint,
  useDurationLabels,
  useFormDates,
} from '../field-labels';
import { TeacherField, useDayLessons } from '../lesson-form-kit';
import { useLessonDates } from '../lesson-format';
import { useLessonForm, useTeacherOptions } from '../lesson-form-parts';
import { useConflictGuard } from './use-conflict-guard';

/**
 * Assign a makeup for a cancelled or missed individual lesson (L-60): date,
 * start, length, the teacher (another one for this lesson only) and the
 * topic, with whether it is free (L-61). A conflict goes through the conflict
 * dialog (L-111).
 */
export function MakeupDialog({
  lesson,
  open,
  onOpenChange,
  now,
  onCreated,
}: {
  lesson: LessonDetailResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
  onCreated?: () => void;
}) {
  const t = useTranslations('lessons.makeup');
  const tEdit = useTranslations('lessons.edit');
  const tPanel = useTranslations('lessons.panel');
  const tFields = useTranslations('lessons.fields');
  const dates = useLessonDates();
  const teachers = useTeacherOptions();
  const formDates = useFormDates();
  const durationLabels = useDurationLabels();
  const durationHint = useDurationHint();
  const create = useCreateMakeupMutation(lesson.id);
  const guard = useConflictGuard();
  const timeZone = useStudioTimeZone();
  const defaults = makeupFormDefaults(lesson, now, timeZone);
  const form = useLessonForm<MakeupFormValues>(makeupFormSchema, defaults);
  const [date, time, durationMin, teacherId] = useWatch({
    control: form.control,
    name: ['date', 'time', 'durationMin', 'teacherId'],
  });
  const dateLabels = useDateRowsLabels([date]);
  const dayLessons = useDayLessons([date]);
  const minutes = Number(durationMin);
  const scope = { teacherId, studentId: lesson.student?.id ?? null };
  const start =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
      ? localInstant(date, time, timeZone)
      : null;
  const free = makeupWillBeFree(lesson);
  const original = dates.longDay(lesson.startsAtUtc);

  const close = (next: boolean) => {
    if (!next) form.reset(defaults);
    onOpenChange(next);
  };
  const submit = form.handleSubmit((values) =>
    guard.run(
      {
        startsAtUtc: zonedIso(values.date, values.time, timeZone),
        durationMin: Number(values.durationMin),
        title: lesson.student?.fullName ?? '',
        teacherName: teachers.names.get(values.teacherId) ?? lesson.teacher.name,
      },
      async (force) => {
        await create.mutateAsync({ dto: makeupDto(values, lesson, timeZone), force });
      },
      () => {
        toast.success(t('done'));
        close(false);
        onCreated?.();
      },
    ),
  );

  return (
    <>
      <AdaptiveDialog
        open={open}
        onOpenChange={close}
        closeLabel={tPanel('close')}
        icon={<CalendarPlusIcon />}
        iconClassName="bg-tile-indigo text-tile-indigo-foreground"
        title={t('title')}
        description={t('subtitle', {
          status: lesson.status,
          date: original,
          name: lesson.student?.fullName ?? '',
        })}
        secondary={
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {t('cancel')}
          </Button>
        }
        primary={
          <Button type="button" disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('confirm')}
          </Button>
        }
      >
        <Notice
          appearance="callout"
          tone={free ? 'success' : 'info'}
          icon={free ? <GiftIcon /> : <BanknoteIcon />}
          title={free ? t('freeTitle') : t('chargedTitle')}
          text={free ? t('freeText', { date: original }) : t('chargedText', { date: original })}
        />
        <DateRowsField
          fixed
          rows={[{ key: 'makeup', date, time }]}
          labels={dateLabels}
          formatDate={formDates.field}
          locale={formDates.locale}
          onDateChange={(_, value) =>
            form.setValue('date', value, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            })
          }
          onTimeChange={(_, value) =>
            form.setValue('time', value, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            })
          }
          busy={[busySlots(dayLessons, scope, date, timeSteps(15), timeZone)]}
          errors={[
            {
              date: form.formState.errors.date?.message,
              time: form.formState.errors.time?.message,
            },
          ]}
        />
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field, fieldState }) => (
            <FieldFrame
              label={tFields('duration')}
              hint={durationHint(Number(field.value), time)}
              error={fieldState.error?.message}
            >
              {(a11y) => (
                <DurationField
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={Boolean(a11y.invalid)}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  labels={durationLabels}
                  usual={lesson.durationMin}
                />
              )}
            </FieldFrame>
          )}
        />
        <Controller
          control={form.control}
          name="teacherId"
          render={({ field, fieldState }) => (
            <TeacherField
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              regularTeacherId={lesson.teacherId}
              hint={t('teacherHint')}
              substitution={false}
              lessons={dayLessons}
              start={start}
              durationMin={minutes}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="topic"
          render={({ field, fieldState }) => (
            <TextField label={tEdit('topic')} error={fieldState.error?.message} {...field} />
          )}
        />
      </AdaptiveDialog>
      {guard.dialog}
    </>
  );
}
