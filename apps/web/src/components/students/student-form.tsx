'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
import { detectTimezone, TimezoneCombobox } from '@/components/app/timezone-combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateStudentMutation, useUpdateStudentMutation } from '@/lib/api/students';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  EMPTY_STUDENT_FORM,
  studentFormSchema,
  type StudentFormValues,
} from '@/lib/forms/schemas';

// One component for both modes: creating sends only filled fields, editing
// sends null for cleared ones so the API knows to erase them. Rendered inside
// a Dialog (see StudentFormDialog) — the caller owns the open state and is
// told when to close it via onSuccess/onCancel rather than the form
// navigating itself.
export function StudentForm({
  student,
  onSuccess,
  onCancel,
}: {
  student?: StudentDetail;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');

  const isEdit = Boolean(student);
  const createStudent = useCreateStudentMutation();
  const updateStudent = useUpdateStudentMutation(student?.id ?? '');
  const mutation = isEdit ? updateStudent : createStudent;

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: student
      ? {
          fullName: student.fullName,
          email: student.email ?? '',
          phone: student.phone ?? '',
          timezone: student.timezone,
          parentName: student.parentName ?? '',
          parentEmail: student.parentEmail ?? '',
          parentPhone: student.parentPhone ?? '',
          notes: student.notes ?? '',
        }
      : EMPTY_STUDENT_FORM,
  });
  const { errors, isSubmitting } = form.formState;
  const timezone = form.watch('timezone');

  // New students default to the browser timezone (Europe/Kyiv as fallback).
  useEffect(() => {
    if (!isEdit && !form.getValues('timezone')) {
      form.setValue('timezone', detectTimezone());
    }
  }, [isEdit, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const optional = (value: string) => (value.trim() === '' ? undefined : value);
    try {
      if (student) {
        // PATCH: an emptied field becomes null so the API clears it.
        const cleared = (value: string) => (value.trim() === '' ? null : value);
        await updateStudent.mutateAsync({
          fullName: values.fullName,
          email: cleared(values.email),
          phone: cleared(values.phone),
          timezone: values.timezone,
          parentName: cleared(values.parentName),
          parentEmail: cleared(values.parentEmail),
          parentPhone: cleared(values.parentPhone),
          notes: cleared(values.notes),
        });
        toast.success(tStudents('toasts.updated'));
        onSuccess?.();
        return;
      }

      await createStudent.mutateAsync({
        fullName: values.fullName,
        email: optional(values.email),
        phone: optional(values.phone),
        timezone: values.timezone,
        parentName: optional(values.parentName),
        parentEmail: optional(values.parentEmail),
        parentPhone: optional(values.parentPhone),
        notes: optional(values.notes),
      });
      toast.success(tStudents('toasts.created'));
      onSuccess?.();
    } catch {
      // Surfaced by the alert below.
    }
  });

  const pending = isSubmitting || mutation.isPending;

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

        <FieldSet>
          <FieldLegend>{t('basicSection')}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={errors.fullName ? true : undefined}>
              <FieldLabel htmlFor="student-full-name">{t('fullName')}</FieldLabel>
              <Input
                id="student-full-name"
                autoComplete="name"
                aria-invalid={errors.fullName ? true : undefined}
                {...form.register('fullName')}
              />
              <FieldError errors={[errors.fullName]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('contactsSection')}</FieldLegend>
          <FieldDescription>{t('contactsHint')}</FieldDescription>
          <FieldGroup>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="student-email">{t('email')}</FieldLabel>
              <Input
                id="student-email"
                type="email"
                inputMode="email"
                spellCheck={false}
                aria-invalid={errors.email ? true : undefined}
                {...form.register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor="student-phone">{t('phone')}</FieldLabel>
              <Input
                id="student-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={errors.phone ? true : undefined}
                {...form.register('phone')}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('timezoneSection')}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={errors.timezone ? true : undefined}>
              <FieldLabel htmlFor="student-timezone">{t('timezone')}</FieldLabel>
              <TimezoneCombobox
                id="student-timezone"
                value={timezone}
                onChange={(value) =>
                  form.setValue('timezone', value, { shouldValidate: true })
                }
                placeholder={t('timezonePlaceholder')}
                searchPlaceholder={t('timezoneSearch')}
                emptyLabel={t('timezoneEmpty')}
                invalid={Boolean(errors.timezone)}
              />
              <FieldDescription>{t('timezoneHint')}</FieldDescription>
              <FieldError errors={[errors.timezone]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('parentSection')}</FieldLegend>
          <FieldDescription>{t('parentHint')}</FieldDescription>
          <FieldGroup>
            <Field data-invalid={errors.parentName ? true : undefined}>
              <FieldLabel htmlFor="student-parent-name">{t('parentName')}</FieldLabel>
              <Input
                id="student-parent-name"
                aria-invalid={errors.parentName ? true : undefined}
                {...form.register('parentName')}
              />
              <FieldError errors={[errors.parentName]} />
            </Field>
            <Field data-invalid={errors.parentEmail ? true : undefined}>
              <FieldLabel htmlFor="student-parent-email">{t('parentEmail')}</FieldLabel>
              <Input
                id="student-parent-email"
                type="email"
                inputMode="email"
                spellCheck={false}
                aria-invalid={errors.parentEmail ? true : undefined}
                {...form.register('parentEmail')}
              />
              <FieldError errors={[errors.parentEmail]} />
            </Field>
            <Field data-invalid={errors.parentPhone ? true : undefined}>
              <FieldLabel htmlFor="student-parent-phone">{t('parentPhone')}</FieldLabel>
              <Input
                id="student-parent-phone"
                type="tel"
                inputMode="tel"
                aria-invalid={errors.parentPhone ? true : undefined}
                {...form.register('parentPhone')}
              />
              <FieldError errors={[errors.parentPhone]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('notesSection')}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={errors.notes ? true : undefined}>
              <FieldLabel htmlFor="student-notes">{t('notes')}</FieldLabel>
              <Textarea
                id="student-notes"
                rows={4}
                placeholder={t('notesPlaceholder')}
                aria-invalid={errors.notes ? true : undefined}
                {...form.register('notes')}
              />
              <FieldError errors={[errors.notes]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {isEdit ? t('submitEdit') : t('submitCreate')}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
