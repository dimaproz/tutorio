'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSession } from '@/components/app/session-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
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
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateWorkspaceSettingsMutation } from '@/lib/api/workspace';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  workspaceSettingsFormSchema,
  type WorkspaceSettingsFormValues,
} from '@/lib/forms/schemas';

const CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

export function WorkspaceSettingsForm() {
  const t = useTranslations('settings.general');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const session = useSession();
  const updateSettings = useUpdateWorkspaceSettingsMutation();

  const form = useForm<WorkspaceSettingsFormValues>({
    resolver: zodResolver(workspaceSettingsFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: {
      defaultCurrency: session.workspace
        .defaultCurrency as WorkspaceSettingsFormValues['defaultCurrency'],
      cancellationDeadlineHours: session.workspace.cancellationDeadlineHours,
    },
  });
  const { errors } = form.formState;
  const currency = form.watch('defaultCurrency');

  // Keep the form in sync after the session query refetches post-save.
  useEffect(() => {
    form.reset({
      defaultCurrency: session.workspace
        .defaultCurrency as WorkspaceSettingsFormValues['defaultCurrency'],
      cancellationDeadlineHours: session.workspace.cancellationDeadlineHours,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on server values
  }, [session.workspace.defaultCurrency, session.workspace.cancellationDeadlineHours]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateSettings.mutateAsync(values);
      toast.success(t('saved'));
    } catch {
      // Surfaced by the alert below.
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {updateSettings.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {tErrors(errorMessageKey(updateSettings.error))}
                </AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="settings-currency">{t('defaultCurrency')}</FieldLabel>
              <Select
                value={currency}
                onValueChange={(value) =>
                  form.setValue(
                    'defaultCurrency',
                    value as WorkspaceSettingsFormValues['defaultCurrency'],
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger id="settings-currency" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {/* Money is a snapshot: changing the default never rewrites
                  existing enrollments. */}
              <FieldDescription>{t('priceNotice')}</FieldDescription>
            </Field>

            <Field data-invalid={errors.cancellationDeadlineHours ? true : undefined}>
              <FieldLabel htmlFor="settings-deadline">{t('cancellationDeadline')}</FieldLabel>
              <Input
                id="settings-deadline"
                inputMode="numeric"
                className="w-full sm:w-56"
                aria-invalid={errors.cancellationDeadlineHours ? true : undefined}
                {...form.register('cancellationDeadlineHours')}
              />
              <FieldDescription>{t('deadlineNotice')}</FieldDescription>
              <FieldError errors={[errors.cancellationDeadlineHours]} />
            </Field>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? <Spinner data-icon="inline-start" /> : null}
                {t('submit')}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
