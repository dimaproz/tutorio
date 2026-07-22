'use client';

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
          telegramUsername: parent.telegramUsername ?? '',
          notes: parent.notes ?? '',
        }
      : EMPTY_PARENT_FORM,
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const optional = (value: string) => (value.trim() === '' ? undefined : value);
    try {
      if (parent) {
        const cleared = (value: string) => (value.trim() === '' ? null : value);
        const updated = await updateParent.mutateAsync({
          fullName: values.fullName,
          phone: cleared(values.phone),
          telegramUsername: cleared(values.telegramUsername),
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
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

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
            aria-invalid={errors.phone ? true : undefined}
            {...form.register('phone')}
          />
          <FieldError errors={[errors.phone]} />
        </Field>

        <Field data-invalid={errors.telegramUsername ? true : undefined}>
          <FieldLabel htmlFor="parent-telegram">{t('telegramUsername')}</FieldLabel>
          <Input
            id="parent-telegram"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.telegramUsername ? true : undefined}
            {...form.register('telegramUsername')}
          />
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
