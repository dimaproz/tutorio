'use client';

import { BanknoteIcon, CalendarPlusIcon, GiftIcon, GraduationCapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityPicker } from '@/components/shared/entity-picker';
import { Notice } from '@/components/shared/notice';
import { TextField } from '@/components/shared/text-field';
import { localInputToIso } from '@/lib/datetime';
import { useCreateMakeupMutation } from '../../api';
import {
  makeupDto,
  makeupFormDefaults,
  makeupFormSchema,
  makeupWillBeFree,
  type MakeupFormValues,
} from '../../model/makeup';
import { useLessonDates } from '../lesson-format';
import {
  FieldSlot,
  LessonDateField,
  useDurationOptions,
  useLessonForm,
  useTeacherOptions,
} from '../lesson-form-parts';
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
  const dates = useLessonDates();
  const teachers = useTeacherOptions();
  const durations = useDurationOptions(lesson.durationMin);
  const create = useCreateMakeupMutation(lesson.id);
  const guard = useConflictGuard();
  const defaults = makeupFormDefaults(lesson, now);
  const form = useLessonForm<MakeupFormValues>(makeupFormSchema, defaults);
  const free = makeupWillBeFree(lesson);
  const original = dates.longDay(lesson.startsAtUtc);

  const close = (next: boolean) => {
    if (!next) form.reset(defaults);
    onOpenChange(next);
  };
  const submit = form.handleSubmit((values) =>
    guard.run(
      {
        startsAtUtc: localInputToIso(`${values.date}T${values.time}`),
        durationMin: Number(values.durationMin),
        title: lesson.student?.fullName ?? '',
        teacherName: teachers.names.get(values.teacherId) ?? lesson.teacher.name,
      },
      async (force) => {
        await create.mutateAsync({ dto: makeupDto(values, lesson), force });
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
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={form.control}
            name="date"
            render={({ field, fieldState }) => (
              <FieldSlot label={tEdit('date')} error={fieldState.error?.message}>
                {(a11y) => (
                  <LessonDateField
                    id={a11y.id}
                    describedBy={a11y.describedBy}
                    invalid={a11y.invalid}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </FieldSlot>
            )}
          />
          <Controller
            control={form.control}
            name="time"
            render={({ field, fieldState }) => (
              <TextField
                type="time"
                label={tEdit('start')}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field, fieldState }) => (
            <TextField
              type="select"
              label={tEdit('duration')}
              options={durations}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="teacherId"
          render={({ field, fieldState }) => (
            <FieldSlot
              label={tEdit('teacher')}
              hint={t('teacherHint')}
              error={fieldState.error?.message}
            >
              {(a11y) => (
                <EntityPicker
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={a11y.invalid}
                  appearance="field"
                  icon={<GraduationCapIcon />}
                  value={field.value}
                  options={teachers.options}
                  isLoading={teachers.loading}
                  onChange={(value) => field.onChange(value ?? field.value)}
                  placeholder={tEdit('teacherPlaceholder')}
                  searchPlaceholder={tEdit('teacherSearch')}
                  emptyLabel={tEdit('teacherEmpty')}
                />
              )}
            </FieldSlot>
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
