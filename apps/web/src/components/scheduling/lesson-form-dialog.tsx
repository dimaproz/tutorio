'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  BanknoteIcon,
  CalendarClockIcon,
  PlusIcon,
  StickyNoteIcon,
  Trash2Icon,
  UserRoundIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import {
  DateTimePicker,
  EntityFormDialog,
  EntityPicker,
  FormActions,
} from '@/components/shared';
import {
  buildCreateLessonDto,
  effectiveTeacherId,
  EMPTY_LESSON_FORM,
  lessonFormSchema,
  prefillPriceMinor,
  type LessonFormValues,
} from '@/features/scheduling/model/lesson-form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateLessonMutation } from '@/lib/api/scheduling';
import { useStudentsQuery } from '@/lib/api/students';
import { useTeachersQuery } from '@/lib/api/teachers';
import { toLocalDateTimeInput } from '@/lib/datetime';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { formatPriceInput } from '@/lib/money';

export function LessonFormDialog({
  open,
  onOpenChange,
  initialStart,
  lockedStudentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStart?: Date;
  /** Set when opened from a student page — the student is fixed. */
  lockedStudentId?: string;
}) {
  const t = useTranslations('scheduling.lessonForm');
  const tConflict = useTranslations('scheduling.conflict');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');

  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, open);
  const createLesson = useCreateLessonMutation();

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema, {
      errorMap: makeZodErrorMap(tValidation, {
        studentId: { invalid: 'studentRequired' },
      }),
      path: [],
      async: true,
    }),
    defaultValues: EMPTY_LESSON_FORM,
  });
  const { errors } = form.formState;
  const dates = useFieldArray({ control: form.control, name: 'startsAt' });
  const studentId = useWatch({ control: form.control, name: 'studentId' });
  const teacherId = useWatch({ control: form.control, name: 'teacherId' });

  // Refill whenever the dialog opens so a reopened form never shows stale data.
  useEffect(() => {
    if (!open) {
      return;
    }
    createLesson.reset();
    form.reset({
      ...EMPTY_LESSON_FORM,
      studentId: lockedStudentId ?? '',
      startsAt: [{ value: initialStart ? toLocalDateTimeInput(initialStart) : '' }],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open, lockedStudentId, initialStart]);

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

  // A single-teacher workspace never asks who is teaching.
  const resolvedTeacherId = effectiveTeacherId(teacherId, teacherOptions);
  const selectedStudent = students.data?.items.find((item) => item.id === studentId);

  /** Prefills the price from the most specific configured rate; still editable. */
  const applyDefaultPrice = (nextStudentId: string, nextTeacherId: string) => {
    const minor = prefillPriceMinor(
      students.data?.items.find((item) => item.id === nextStudentId),
      teachers.data?.items.find((item) => item.id === nextTeacherId),
    );
    form.setValue('price', minor === null ? '' : formatPriceInput(minor));
  };

  const onSubmit = (force: boolean) =>
    form.handleSubmit(async (values) => {
      const dto = buildCreateLessonDto(values, {
        teacherId: resolvedTeacherId,
        currency: selectedStudent?.currency,
      });
      try {
        await createLesson.mutateAsync({ dto, force });
        onOpenChange(false);
      } catch (error) {
        if ((error as { status?: number }).status === 409) {
          toast.error(tConflict('message'), {
            action: {
              label: tConflict('force'),
              onClick: () => void onSubmit(true)(),
            },
          });
          return;
        }
        // Surfaced by the alert below.
      }
    }, scrollToFirstError);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('createTitle')}
      description={t('createSubtitle')}
    >
      <form onSubmit={onSubmit(false)} noValidate className="flex flex-col gap-7">
        {createLesson.error && createLesson.error.status !== 409 ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {tErrors(errorMessageKey(createLesson.error))}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormSection
          icon={UserRoundIcon}
          title={t('student')}
          description={t('studentHint')}
          tone="primary"
        >
          {!lockedStudentId ? (
            <Controller
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <Field data-invalid={errors.studentId ? true : undefined}>
                  <FieldLabel htmlFor="lesson-student">{t('student')}</FieldLabel>
                  <EntityPicker
                    id="lesson-student"
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
          ) : null}

          {/* One teacher in the workspace: nothing to choose. */}
          {teacherOptions.length > 1 ? (
            <Controller
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <Field data-invalid={errors.teacherId ? true : undefined}>
                  <FieldLabel htmlFor="lesson-teacher">{t('teacher')}</FieldLabel>
                  <EntityPicker
                    id="lesson-teacher"
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

        <FormSection
          icon={CalendarClockIcon}
          title={t('date')}
          description={t('addDate')}
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
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(errors.startsAt)}
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
                variant="outline"
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
            <Input
              id="lesson-duration"
              type="number"
              min={5}
              max={720}
              aria-invalid={errors.durationMin ? true : undefined}
              {...form.register('durationMin')}
            />
            <FieldError errors={[errors.durationMin]} />
          </Field>
        </FormSection>

        <FormSection icon={BanknoteIcon} title={t('price')} tone="success">
          <Field data-invalid={errors.price ? true : undefined}>
            <FieldLabel htmlFor="lesson-price">{t('price')}</FieldLabel>
            <MoneyInput
              id="lesson-price"
              placeholder={t('pricePlaceholder')}
              aria-invalid={errors.price ? true : undefined}
              {...form.register('price')}
            />
            <FieldDescription>{t('studentHint')}</FieldDescription>
            <FieldError errors={[errors.price]} />
          </Field>
        </FormSection>

        <FormSection icon={StickyNoteIcon} title={t('notes')} tone="neutral">
          <Field data-invalid={errors.notes ? true : undefined}>
            <FieldLabel htmlFor="lesson-notes">{t('notes')}</FieldLabel>
            <Textarea
              id="lesson-notes"
              placeholder={t('notesPlaceholder')}
              {...form.register('notes')}
            />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={createLesson.isPending}>
            {createLesson.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FormActions>
      </form>
    </EntityFormDialog>
  );
}
