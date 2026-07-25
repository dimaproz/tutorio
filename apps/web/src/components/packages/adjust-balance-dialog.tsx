'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { SlidersHorizontalIcon, StickyNoteIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { FormSection } from '@/components/app/form-section';
import { EntityFormDialog, FormActions } from '@/components/shared';
import {
  adjustFormSchema,
  buildAdjustBalanceDto,
  EMPTY_ADJUST_FORM,
  type AdjustFormValues,
} from '@/features/packages/model/payment-form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useAdjustBalanceMutation } from '@/lib/api/packages';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';

/**
 * A tutor's own correction. The note is required: an append-only ledger is only
 * useful if every entry says why it exists.
 */
export function AdjustBalanceDialog({
  open,
  onOpenChange,
  packageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
}) {
  const t = useTranslations('packages.adjustDialog');
  const tPackages = useTranslations('packages');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const adjust = useAdjustBalanceMutation();

  const form = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: EMPTY_ADJUST_FORM,
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (!open) {
      return;
    }
    adjust.reset();
    form.reset(EMPTY_ADJUST_FORM);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await adjust.mutateAsync({ packageId, dto: buildAdjustBalanceDto(values) });
      toast.success(tPackages('toasts.adjusted'));
      onOpenChange(false);
    } catch {
      // Surfaced by the alert below.
    }
  }, scrollToFirstError);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('subtitle')}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
        {adjust.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(adjust.error))}</AlertDescription>
          </Alert>
        ) : null}

        <FormSection
          icon={SlidersHorizontalIcon}
          title={t('delta')}
          description={t('deltaHint')}
          tone="warning"
        >
          <Field data-invalid={errors.delta ? true : undefined}>
            <FieldLabel htmlFor="adjust-delta">{t('delta')}</FieldLabel>
            <Input
              id="adjust-delta"
              type="number"
              step={1}
              min={-500}
              max={500}
              aria-invalid={errors.delta ? true : undefined}
              {...form.register('delta')}
            />
            <FieldError errors={[errors.delta]} />
          </Field>
        </FormSection>

        <FormSection
          icon={StickyNoteIcon}
          title={t('note')}
          description={t('subtitle')}
          tone="neutral"
        >
          <Field data-invalid={errors.note ? true : undefined}>
            <FieldLabel htmlFor="adjust-note">{t('note')}</FieldLabel>
            <Textarea
              id="adjust-note"
              aria-invalid={errors.note ? true : undefined}
              {...form.register('note')}
            />
            <FieldDescription>{tCommon('required')}</FieldDescription>
            <FieldError errors={[errors.note]} />
          </Field>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FormActions>
      </form>
    </EntityFormDialog>
  );
}
