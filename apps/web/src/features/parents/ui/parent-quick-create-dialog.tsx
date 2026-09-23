'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailIcon, PhoneIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { ParentResponse } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EntityFormDialog } from '@/components/shared/entity-form-dialog';
import { FormActions } from '@/components/shared/form-actions';
import { TextField } from '@/components/shared/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  EMPTY_PARENT_QUICK_CREATE,
  buildParentQuickCreateDto,
  parentQuickCreateSchema,
  type ParentQuickCreateValues,
} from '@/features/parents/model/form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateParentMutation } from '@/lib/api/parents';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';

/**
 * Create a parent contact without leaving another workflow — the student
 * profile's "Create a new contact". It creates only the parent; the caller
 * links it, so a failed link can be retried without a second record.
 */
export function ParentQuickCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (parent: ParentResponse) => void;
}) {
  const t = useTranslations('parents.form');
  const tParents = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const create = useCreateParentMutation();
  const [discardOpen, setDiscardOpen] = useState(false);
  const form = useForm<ParentQuickCreateValues>({
    resolver: zodResolver(parentQuickCreateSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: EMPTY_PARENT_QUICK_CREATE,
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  const pending = isSubmitting || create.isPending;

  useEffect(() => {
    if (!open) return;
    create.reset();
    form.reset(EMPTY_PARENT_QUICK_CREATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once per opening
  }, [open]);

  const requestClose = () => {
    if (pending) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const phone = form.register('phone', {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(/[^\d\s()+-]/g, '');
    },
  });
  const telegram = form.register('telegramUsername', {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(/^@+/, '').replace(/[^\w]/g, '');
    },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const parent = await create.mutateAsync(buildParentQuickCreateDto(values));
      toast.success(tParents('toasts.created'));
      form.reset(values);
      onOpenChange(false);
      onSuccess?.(parent);
    } catch {
      // The localized request error stays visible with every entered value.
    }
  }, scrollToFirstError);

  return (
    <>
      <EntityFormDialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
        title={t('quickCreateTitle')}
        description={t('quickCreateSubtitle')}
        width="md"
        footer={
          <FormActions>
            <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" form="parent-quick-create-form" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? t('creating') : t('submitCreate')}
            </Button>
          </FormActions>
        }
      >
        <form
          id="parent-quick-create-form"
          noValidate
          // Portalled but still a React descendant of the profile: without this
          // a submit here would bubble to any form around the caller.
          onSubmit={(event) => {
            event.stopPropagation();
            void submit(event);
          }}
        >
          <FieldGroup>
            {create.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{tErrors(errorMessageKey(create.error))}</AlertDescription>
              </Alert>
            ) : null}
            <TextField
              label={t('fullName')}
              required
              autoFocus
              autoComplete="off"
              placeholder={t('fullNamePlaceholder')}
              error={errors.fullName?.message}
              {...form.register('fullName')}
            />
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <TextField
                label={t('phone')}
                type="tel"
                inputMode="tel"
                icon={<PhoneIcon />}
                placeholder={t('phonePlaceholder')}
                error={errors.phone?.message}
                {...phone}
              />
              <TextField
                label={t('telegramUsername')}
                prefix="@"
                autoComplete="off"
                placeholder={t('telegramPlaceholder')}
                error={errors.telegramUsername?.message}
                {...telegram}
              />
            </div>
            <TextField
              label={t('email')}
              type="email"
              icon={<MailIcon />}
              autoComplete="off"
              placeholder={t('emailPlaceholder')}
              error={errors.email?.message}
              {...form.register('email')}
            />
          </FieldGroup>
        </form>
      </EntityFormDialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        tone="danger"
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardAction')}
        onConfirm={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
