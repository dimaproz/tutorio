'use client';

import { type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ParentDetail } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { AvatarPicker } from '@/components/app/avatar-picker';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateParentMutation, useUpdateParentMutation } from '@/lib/api/parents';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { EMPTY_PARENT_FORM, parentFormSchema, type ParentFormValues } from '@/lib/forms/schemas';

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
          notes: parent.notes ?? '',
        }
      : EMPTY_PARENT_FORM,
  });
  const { errors, isSubmitting } = form.formState;
  const values = form.watch();

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

        <Field>
          <FieldLabel htmlFor="parent-avatar">{t('avatarSection')}</FieldLabel>
          <AvatarPicker
            value={values.avatarKey ?? null}
            onChange={(next) => form.setValue('avatarKey', next)}
            fullName={values.fullName}
            initialsLabel={t('avatarInitials')}
          />
        </Field>

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

        <Field data-invalid={errors.notes ? true : undefined}>
          <FieldLabel htmlFor="parent-notes">{t('notes')}</FieldLabel>
          <Textarea
            id="parent-notes"
            rows={4}
            placeholder={t('notesPlaceholder')}
            aria-invalid={errors.notes ? true : undefined}
            {...form.register('notes')}
          />
          <FieldError errors={[errors.notes]} />
        </Field>

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
