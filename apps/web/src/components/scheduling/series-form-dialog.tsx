'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BanknoteIcon, RepeatIcon, UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonSeriesResponse } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import {
  detectTimezone,
  TimezoneCombobox,
} from '@/components/app/timezone-combobox';
import {
  DatePicker,
  EntityFormDialog,
  EntityPicker,
  FormActions,
  TimePicker,
  WeekdayPicker,
} from '@/components/shared';
import {
  effectiveTeacherId,
  prefillPriceMinor,
} from '@/features/scheduling/model/lesson-form';
import {
  buildCreateSeriesDto,
  buildUpdateSeriesDto,
  emptySeriesForm,
  seriesFormSchema,
  seriesToForm,
  type SeriesFormValues,
} from '@/features/scheduling/model/series-form';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useCreateSeriesMutation,
  useUpdateSeriesMutation,
} from '@/lib/api/scheduling';
import { useStudentsQuery } from '@/lib/api/students';
import { useTeachersQuery } from '@/lib/api/teachers';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { formatPriceInput } from '@/lib/money';

export function SeriesFormDialog({
  open,
  onOpenChange,
  series,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  series?: LessonSeriesResponse;
}) {
  const t = useTranslations('scheduling.seriesForm');
  const tPatterns = useTranslations('scheduling.patterns');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');

  const isEdit = Boolean(series);
  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open && !isEdit);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, open && !isEdit);
  const createSeries = useCreateSeriesMutation();
  const updateSeries = useUpdateSeriesMutation(series?.id ?? '');
  const mutation = isEdit ? updateSeries : createSeries;

  const form = useForm<SeriesFormValues>({
    resolver: zodResolver(seriesFormSchema, {
      errorMap: makeZodErrorMap(tValidation, {
        studentId: { invalid: 'studentRequired' },
        weekdays: { tooSmall: 'weekdaysRequired' },
      }),
      path: [],
      async: true,
    }),
    defaultValues: emptySeriesForm(detectTimezone()),
  });
  const { errors } = form.formState;
  const studentId = useWatch({ control: form.control, name: 'studentId' });
  const teacherId = useWatch({ control: form.control, name: 'teacherId' });

  useEffect(() => {
    if (!open) {
      return;
    }
    mutation.reset();
    form.reset(series ? seriesToForm(series) : emptySeriesForm(detectTimezone()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open, series?.id]);

  const studentOptions = useMemo(
    () =>
      (students.data?.items ?? []).map((student) => ({
        value: student.id,
        label: student.fullName,
        avatarKey: student.avatarKey,
      })),
    [students.data],
  );
  const teacherOptions = useMemo(
    () =>
      (teachers.data?.items ?? []).map((teacher) => ({
        value: teacher.id,
        label: teacher.fullName,
        avatarKey: teacher.avatarKey,
      })),
    [teachers.data],
  );

  const resolvedTeacherId = effectiveTeacherId(teacherId, teacherOptions);
  const selectedStudent = students.data?.items.find((item) => item.id === studentId);

  const applyDefaultPrice = (nextStudentId: string, nextTeacherId: string) => {
    const minor = prefillPriceMinor(
      students.data?.items.find((item) => item.id === nextStudentId),
      teachers.data?.items.find((item) => item.id === nextTeacherId),
    );
    form.setValue('price', minor === null ? '' : formatPriceInput(minor));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateSeries.mutateAsync(buildUpdateSeriesDto(values));
        toast.success(tPatterns('toastUpdated'));
      } else {
        await createSeries.mutateAsync(
          buildCreateSeriesDto(values, {
            teacherId: resolvedTeacherId,
            currency: selectedStudent?.currency,
          }),
        );
        toast.success(tPatterns('toastCreated'));
      }
      onOpenChange(false);
    } catch {
      // Surfaced by the alert below.
    }
  }, scrollToFirstError);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('editTitle') : t('createTitle')}
      description={isEdit ? t('editSubtitle') : t('createSubtitle')}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

        {!isEdit ? (
          <FormSection
            icon={UserRoundIcon}
            title={t('student')}
            description={t('createSubtitle')}
            tone="primary"
          >
            <Controller
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <Field data-invalid={errors.studentId ? true : undefined}>
                  <FieldLabel htmlFor="series-student">{t('student')}</FieldLabel>
                  <EntityPicker
                    id="series-student"
                    value={field.value}
                    options={studentOptions}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                      applyDefaultPrice(value ?? '', resolvedTeacherId);
                    }}
                    placeholder={t('studentPlaceholder')}
                    searchPlaceholder={t('studentSearch')}
                    emptyLabel={t('studentEmpty')}
                    invalid={Boolean(errors.studentId)}
                    isLoading={students.isPending}
                  />
                  <FieldError errors={[errors.studentId]} />
                </Field>
              )}
            />

            {teacherOptions.length > 1 ? (
              <Controller
                control={form.control}
                name="teacherId"
                render={({ field }) => (
                  <Field data-invalid={errors.teacherId ? true : undefined}>
                    <FieldLabel htmlFor="series-teacher">{t('teacher')}</FieldLabel>
                    <EntityPicker
                      id="series-teacher"
                      value={field.value}
                      options={teacherOptions}
                      onChange={(value) => {
                        field.onChange(value ?? '');
                        applyDefaultPrice(studentId, value ?? '');
                      }}
                      placeholder={t('teacherPlaceholder')}
                      searchPlaceholder={t('teacherSearch')}
                      emptyLabel={t('teacherEmpty')}
                      invalid={Boolean(errors.teacherId)}
                      isLoading={teachers.isPending}
                    />
                    <FieldError errors={[errors.teacherId]} />
                  </Field>
                )}
              />
            ) : null}
          </FormSection>
        ) : null}

        <FormSection
          icon={RepeatIcon}
          title={t('weekdays')}
          description={isEdit ? t('editSubtitle') : undefined}
          tone="warning"
        >
          <Controller
            control={form.control}
            name="weekdays"
            render={({ field }) => (
              <Field data-invalid={errors.weekdays ? true : undefined}>
                <FieldLabel htmlFor="series-weekdays">{t('weekdays')}</FieldLabel>
                <WeekdayPicker
                  id="series-weekdays"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.weekdays)}
                />
                <FieldError
                  errors={[errors.weekdays as { message?: string } | undefined]}
                />
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="localTime"
              render={({ field }) => (
                <Field data-invalid={errors.localTime ? true : undefined}>
                  <FieldLabel htmlFor="series-time">{t('time')}</FieldLabel>
                  <TimePicker
                    id="series-time"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={Boolean(errors.localTime)}
                  />
                  <FieldError errors={[errors.localTime]} />
                </Field>
              )}
            />
            <Field data-invalid={errors.durationMin ? true : undefined}>
              <FieldLabel htmlFor="series-duration">{t('duration')}</FieldLabel>
              <Input
                id="series-duration"
                type="number"
                min={5}
                max={720}
                aria-invalid={errors.durationMin ? true : undefined}
                {...form.register('durationMin')}
              />
              <FieldError errors={[errors.durationMin]} />
            </Field>
          </div>

          <Controller
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <Field data-invalid={errors.timezone ? true : undefined}>
                <FieldLabel htmlFor="series-timezone">{t('timezone')}</FieldLabel>
                <TimezoneCombobox
                  id="series-timezone"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('timezone')}
                  searchPlaceholder={t('timezone')}
                  emptyLabel={t('timezone')}
                />
                <FieldError errors={[errors.timezone]} />
              </Field>
            )}
          />
        </FormSection>

        <FormSection
          icon={BanknoteIcon}
          title={t('price')}
          tone="success"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={errors.price ? true : undefined}>
              <FieldLabel htmlFor="series-price">{t('price')}</FieldLabel>
              <MoneyInput
                id="series-price"
                aria-invalid={errors.price ? true : undefined}
                {...form.register('price')}
              />
              <FieldError errors={[errors.price]} />
            </Field>
            <Controller
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <Field data-invalid={errors.startDate ? true : undefined}>
                  <FieldLabel htmlFor="series-start">{t('startDate')}</FieldLabel>
                  <DatePicker
                    id="series-start"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={Boolean(errors.startDate)}
                  />
                  <FieldError errors={[errors.startDate]} />
                </Field>
              )}
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FormActions>
      </form>
    </EntityFormDialog>
  );
}
