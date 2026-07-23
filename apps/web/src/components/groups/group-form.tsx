'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GroupDetail } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateGroupMutation, useUpdateGroupMutation } from '@/lib/api/groups';
import { useSession } from '@/components/app/session-provider';
import { CurrencyOption } from '@/components/app/currency-option';
import { MoneyInput } from '@/components/app/money-input';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { groupFormSchema, type GroupFormValues } from '@/lib/forms/schemas';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

const CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

// One component for both create and edit, mirroring StudentForm. Rendered
// inside a Dialog (see GroupFormDialog) — the caller owns the open state and
// is told when to close it via onSuccess/onCancel rather than the form
// navigating itself.
export function GroupForm({
  group,
  onSuccess,
  onCancel,
}: {
  group?: GroupDetail;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('groups.form');
  const tGroups = useTranslations('groups');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');

  const isEdit = Boolean(group);
  const createGroup = useCreateGroupMutation();
  const updateGroup = useUpdateGroupMutation(group?.id ?? '');
  const mutation = isEdit ? updateGroup : createGroup;
  const session = useSession();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: {
      name: group?.name ?? '',
      pricePerLesson:
        group?.pricePerLesson != null ? formatPriceInput(group.pricePerLesson) : '',
      currency:
        (group?.currency as GroupFormValues['currency'] | undefined) ??
        (session.workspace.defaultCurrency as GroupFormValues['currency']),
      notes: group?.notes ?? '',
    },
  });
  const { errors } = form.formState;
  const values = form.watch();

  const onSubmit = form.handleSubmit(async (formValues) => {
    const pricePerLesson =
      formValues.pricePerLesson.trim() === ''
        ? null
        : parsePriceInput(formValues.pricePerLesson);
    try {
      if (group) {
        await updateGroup.mutateAsync({
          name: formValues.name,
          pricePerLesson,
          currency: pricePerLesson === null ? null : formValues.currency,
          // An emptied field becomes null so the API clears it.
          notes: formValues.notes.trim() === '' ? null : formValues.notes,
        });
        toast.success(tGroups('toasts.updated'));
        onSuccess?.();
        return;
      }
      await createGroup.mutateAsync({
        name: formValues.name,
        pricePerLesson: pricePerLesson ?? undefined,
        currency: pricePerLesson === null ? undefined : formValues.currency,
        notes: formValues.notes.trim() === '' ? undefined : formValues.notes,
      });
      toast.success(tGroups('toasts.created'));
      onSuccess?.();
    } catch {
      // Surfaced by the alert below.
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="group-name">{t('name')}</FieldLabel>
          <Input
            id="group-name"
            aria-invalid={errors.name ? true : undefined}
            {...form.register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field data-invalid={errors.pricePerLesson ? true : undefined}>
            <FieldLabel htmlFor="group-price">{t('pricePerLesson')}</FieldLabel>
            <MoneyInput
              id="group-price"
              placeholder={t('pricePerLessonHint')}
              aria-invalid={errors.pricePerLesson ? true : undefined}
              {...form.register('pricePerLesson')}
            />
            <FieldError errors={[errors.pricePerLesson]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="group-currency">{t('currency')}</FieldLabel>
            <Select
              value={values.currency}
              onValueChange={(value) =>
                form.setValue('currency', value as GroupFormValues['currency'])
              }
            >
              <SelectTrigger id="group-currency" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      <CurrencyOption code={currency} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field data-invalid={errors.notes ? true : undefined}>
          <FieldLabel htmlFor="group-notes">{t('notes')}</FieldLabel>
          <Textarea
            id="group-notes"
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
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            {isEdit ? t('submitEdit') : t('submitCreate')}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
