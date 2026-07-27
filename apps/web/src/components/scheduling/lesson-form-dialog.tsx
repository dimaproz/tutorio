'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { StickyNoteIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { FormSection } from '@/components/app/form-section';
import { useSession } from '@/components/app/session-provider';
import { EntityFormDialog, FormActions } from '@/components/shared';
import {
  buildCreateLessonDto,
  effectiveTeacherId,
  EMPTY_LESSON_FORM,
  lessonFormSchema,
  prefillFromGroup,
  prefillFromStudent,
  type LessonFormValues,
  type LessonTarget,
} from '@/features/scheduling/model/lesson-form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useGroupsQuery } from '@/lib/api/groups';
import { useCreateLessonMutation } from '@/lib/api/scheduling';
import { useStudentsQuery } from '@/lib/api/students';
import { useTeachersQuery } from '@/lib/api/teachers';
import { toLocalDateTimeInput } from '@/lib/datetime';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { formatPriceInput } from '@/lib/money';
import { LessonBillingSection, LessonStatusSection } from './lesson-billing-section';
import { LessonScheduleSection } from './lesson-schedule-section';
import { LessonTargetSection } from './lesson-target-section';

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
  const session = useSession();

  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open);
  const groups = useGroupsQuery({ page: 1, pageSize: 100 }, open);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, open);
  const createLesson = useCreateLessonMutation();

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema, {
      errorMap: makeZodErrorMap(tValidation, {
        studentId: { invalid: 'studentRequired' },
        groupId: { invalid: 'groupRequired' },
      }),
      path: [],
      async: true,
    }),
    defaultValues: EMPTY_LESSON_FORM,
  });
  const { errors } = form.formState;
  const teacherId = useWatch({ control: form.control, name: 'teacherId' });

  // Refill whenever the dialog opens so a reopened form never shows stale data.
  useEffect(() => {
    if (!open) {
      return;
    }
    createLesson.reset();
    form.reset({
      ...EMPTY_LESSON_FORM,
      currency: session.workspace.defaultCurrency as LessonFormValues['currency'],
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
  const groupOptions = useMemo(
    () =>
      (groups.data?.items ?? []).map((group) => ({
        value: group.id,
        label: group.name,
      })),
    [groups.data],
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

  /** Prefills price and currency from the most specific configured rate. */
  const applyDefaultPrice = (
    next: Partial<Pick<LessonFormValues, 'target' | 'studentId' | 'groupId' | 'teacherId'>>,
  ) => {
    const values = form.getValues();
    const target = next.target ?? values.target;
    const resolved =
      target === 'group'
        ? prefillFromGroup(
            groups.data?.items.find((item) => item.id === (next.groupId ?? values.groupId)),
          )
        : prefillFromStudent(
            students.data?.items.find(
              (item) => item.id === (next.studentId ?? values.studentId),
            ),
            teachers.data?.items.find(
              (item) => item.id === (next.teacherId ?? resolvedTeacherId),
            ),
          );

    form.setValue('price', resolved ? formatPriceInput(resolved.priceMinor) : '');
    if (resolved) {
      form.setValue('currency', resolved.currency as LessonFormValues['currency']);
    }
  };

  const onSubmit = (force: boolean) =>
    form.handleSubmit(async (values) => {
      const dto = buildCreateLessonDto(values, { teacherId: resolvedTeacherId });
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
      width="md"
    >
      <FormProvider {...form}>
        <form onSubmit={onSubmit(false)} noValidate className="flex flex-col gap-7">
          {createLesson.error && createLesson.error.status !== 409 ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {tErrors(errorMessageKey(createLesson.error))}
              </AlertDescription>
            </Alert>
          ) : null}

          <LessonTargetSection
            studentOptions={studentOptions}
            groupOptions={groupOptions}
            teacherOptions={teacherOptions}
            isLoadingStudents={students.isPending}
            isLoadingGroups={groups.isPending}
            isLoadingTeachers={teachers.isPending}
            lockedStudentId={lockedStudentId}
            onTargetChange={(target: LessonTarget) => applyDefaultPrice({ target })}
            onStudentChange={(studentId) => applyDefaultPrice({ studentId })}
            onGroupChange={(groupId) => applyDefaultPrice({ groupId })}
            onTeacherChange={(nextTeacherId) =>
              applyDefaultPrice({ teacherId: nextTeacherId })
            }
          />

          <LessonScheduleSection teacherId={resolvedTeacherId} />

          <LessonBillingSection />

          <LessonStatusSection />

          <FormSection icon={StickyNoteIcon} title={t('notes')} tone="destructive">
            <Field data-invalid={errors.notes ? true : undefined}>
              <FieldLabel htmlFor="lesson-notes" className="sr-only">
                {t('notes')}
              </FieldLabel>
              <Textarea
                id="lesson-notes"
                rows={4}
                placeholder={t('notesPlaceholder')}
                {...form.register('notes')}
              />
              <FieldError errors={[errors.notes]} />
            </Field>
          </FormSection>

          <FormActions>
            <Button type="button" variant="neutral" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={createLesson.isPending}>
              {createLesson.isPending ? <Spinner data-icon="inline-start" /> : null}
              {t('submit')}
            </Button>
          </FormActions>
        </form>
      </FormProvider>
    </EntityFormDialog>
  );
}
