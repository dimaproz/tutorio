'use client';

import { type ChangeEvent } from 'react';
import { ImageIcon, PhoneIcon, StickyNoteIcon, UserIcon, UsersRoundIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ParentDetail } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { AvatarPicker } from '@/components/app/avatar-picker';
import { FormSection } from '@/components/app/form-section';
import { StudentStatusBadge } from '@/components/app/status-badges';
import { EntityMultiSelect, FormActions } from '@/components/shared';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateParentMutation, useUpdateParentMutation } from '@/lib/api/parents';
import { useStudentsQuery } from '@/lib/api/students';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  EMPTY_PARENT_FORM,
  parentFormSchema,
  type ParentFormValues,
} from '@/features/parents/model/form';

// One component for both create and edit, mirroring StudentForm/GroupForm.
// Rendered inside a Dialog (see ParentFormDialog) — the caller owns the open
// state and is told when to close it via onSuccess/onCancel.
export function ParentForm({
  parent,
  onSuccess,
  onCancel,
}: {
  parent?: ParentDetail;
  onSuccess?: (parent: { id: string; fullName: string }) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('parents.form');
  const tParents = useTranslations('parents');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');
  const tFilters = useTranslations('parents.filters');
  const tSubject = useTranslations('subject');

  const isEdit = Boolean(parent);
  const createParent = useCreateParentMutation();
  const updateParent = useUpdateParentMutation(parent?.id ?? '');
  const mutation = isEdit ? updateParent : createParent;

  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: parent
      ? {
          fullName: parent.fullName,
          phone: parent.phone ?? '',
          telegramUsername: (parent.telegramUsername ?? '').replace(/^@/, ''),
          avatarKey: parent.avatarKey,
          studentIds: parent.students.map((student) => student.id),
          notes: parent.notes ?? '',
        }
      : EMPTY_PARENT_FORM,
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({
    control: form.control,
    defaultValue: form.getValues(),
  }) as ParentFormValues;
  const students = useStudentsQuery({ page: 1, pageSize: 100 });
  const studentOptions = (students.data?.items ?? []).map((student) => ({
    value: student.id,
    label: student.fullName,
    avatarKey: student.avatarKey,
    description: student.subject ? tSubject(student.subject) : undefined,
    badges: [<StudentStatusBadge key="status" status={student.status} />],
  }));

  // Keep the phone field to digits, spaces and + ( ) - as the user types.
  const phoneRegistration = form.register('phone');
  const phoneField = {
    ...phoneRegistration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(/[^\d\s()+-]/g, '');
      return phoneRegistration.onChange(event);
    },
  };

  // Telegram handle: the "@" is a fixed prefix, so the value stays word-chars.
  const telegramRegistration = form.register('telegramUsername');
  const telegramField = {
    ...telegramRegistration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(/[^\w]/g, '');
      return telegramRegistration.onChange(event);
    },
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const optional = (value: string) => (value.trim() === '' ? undefined : value);
    try {
      if (parent) {
        const cleared = (value: string) => (value.trim() === '' ? null : value);
        const updated = await updateParent.mutateAsync({
          fullName: values.fullName,
          phone: cleared(values.phone),
          telegramUsername: cleared(values.telegramUsername),
          avatarKey: values.avatarKey,
          studentIds: values.studentIds,
          notes: cleared(values.notes),
        });
        toast.success(tParents('toasts.updated'));
        onSuccess?.(updated);
        return;
      }

      const created = await createParent.mutateAsync({
        fullName: values.fullName,
        phone: optional(values.phone),
        telegramUsername: optional(values.telegramUsername),
        avatarKey: values.avatarKey ?? undefined,
        studentIds: values.studentIds,
        notes: optional(values.notes),
      });
      toast.success(tParents('toasts.created'));
      onSuccess?.(created);
    } catch {
      // Surfaced by the alert below.
    }
  });

  const pending = isSubmitting || mutation.isPending;

  return (
    // stopPropagation: this dialog is portalled but stays a React descendant of
    // the student form, so without it a submit here bubbles up and submits the
    // student form too.
    <form
      onSubmit={(event) => {
        event.stopPropagation();
        void onSubmit(event);
      }}
      noValidate
    >
      <FieldGroup>
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

        <FormSection icon={ImageIcon} tone="neutral" title={t('avatarSection')}>
          <AvatarPicker
            value={values.avatarKey ?? null}
            onChange={(next) => form.setValue('avatarKey', next)}
            fullName={values.fullName}
            initialsLabel={t('avatarInitials')}
          />
        </FormSection>

        <FieldSeparator />

        <FormSection icon={UserIcon} tone="primary" title={t('basicSection')}>
          <Field data-invalid={errors.fullName ? true : undefined}>
            <FieldLabel htmlFor="parent-full-name">{t('fullName')}</FieldLabel>
            <Input
              id="parent-full-name"
              autoComplete="name"
              aria-invalid={errors.fullName ? true : undefined}
              {...form.register('fullName')}
            />
            <FieldError errors={[errors.fullName]} />
          </Field>
        </FormSection>

        <FieldSeparator />

        <FormSection icon={PhoneIcon} tone="primary" title={t('contactsSection')}>
          <Field data-invalid={errors.phone ? true : undefined}>
            <FieldLabel htmlFor="parent-phone">{t('phone')}</FieldLabel>
            <Input
              id="parent-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('phonePlaceholder')}
              aria-invalid={errors.phone ? true : undefined}
              {...phoneField}
            />
            <FieldError errors={[errors.phone]} />
          </Field>

          <Field data-invalid={errors.telegramUsername ? true : undefined}>
            <FieldLabel htmlFor="parent-telegram">{t('telegramUsername')}</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground select-none">
                @
              </span>
              <Input
                id="parent-telegram"
                autoComplete="off"
                spellCheck={false}
                className="pl-7"
                placeholder={t('telegramPlaceholder')}
                aria-invalid={errors.telegramUsername ? true : undefined}
                {...telegramField}
              />
            </div>
            <FieldError errors={[errors.telegramUsername]} />
          </Field>
        </FormSection>

        <FieldSeparator />

        <FormSection
          icon={UsersRoundIcon}
          tone="warning"
          title={tParents('detail.studentsTitle')}
          description={tParents('detail.noStudentsDescription')}
        >
          <Field>
            <FieldLabel className="sr-only">{tParents('detail.studentsTitle')}</FieldLabel>
            <EntityMultiSelect
              options={studentOptions}
              selectedIds={values.studentIds}
              onChange={(studentIds) =>
                form.setValue('studentIds', studentIds, { shouldValidate: true })
              }
              placeholder={tFilters('allStudents')}
              searchPlaceholder={tFilters('studentSearch')}
              emptyLabel={tFilters('studentEmpty')}
              removeLabel={(name) => `${tCommon('remove')} ${name}`}
              disabled={students.isPending}
              isLoading={students.isPending}
            />
          </Field>
        </FormSection>

        <FieldSeparator />

        <FormSection icon={StickyNoteIcon} tone="destructive" title={t('notesSection')}>
          <Field data-invalid={errors.notes ? true : undefined}>
            <FieldLabel htmlFor="parent-notes" className="sr-only">
              {t('notes')}
            </FieldLabel>
            <Textarea
              id="parent-notes"
              rows={4}
              placeholder={t('notesPlaceholder')}
              aria-invalid={errors.notes ? true : undefined}
              {...form.register('notes')}
            />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? tCommon('saving') : isEdit ? t('submitEdit') : t('submitCreate')}
          </Button>
        </FormActions>
      </FieldGroup>
    </form>
  );
}
