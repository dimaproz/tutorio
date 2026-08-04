'use client';

import { useEffect, useMemo, type CSSProperties } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcwIcon } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSession } from '@/components/app/session-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateWorkspaceSettingsMutation } from '@/lib/api/workspace';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  workspaceThemeFormSchema,
  type WorkspaceThemeFormValues,
} from '@/features/settings/model/form';

const DEFAULT_THEME: WorkspaceThemeFormValues = {
  primaryColor: '#5D87FF',
  secondaryColor: '#49BEFF',
};

export function WorkspaceThemeForm() {
  const t = useTranslations('settings.theme');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const session = useSession();
  const updateSettings = useUpdateWorkspaceSettingsMutation();
  const form = useForm<WorkspaceThemeFormValues>({
    resolver: zodResolver(workspaceThemeFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: {
      primaryColor: session.workspace.primaryColor,
      secondaryColor: session.workspace.secondaryColor,
    },
  });
  const { errors } = form.formState;
  const primaryColor = useWatch({ control: form.control, name: 'primaryColor' });
  const secondaryColor = useWatch({ control: form.control, name: 'secondaryColor' });

  useEffect(() => {
    form.reset({
      primaryColor: session.workspace.primaryColor,
      secondaryColor: session.workspace.secondaryColor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset after a server refresh
  }, [session.workspace.primaryColor, session.workspace.secondaryColor]);

  const previewStyle = useMemo(
    () =>
      ({
        '--theme-preview-primary': primaryColor,
        '--theme-preview-secondary': secondaryColor,
      }) as CSSProperties,
    [primaryColor, secondaryColor],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateSettings.mutateAsync(values);
      toast.success(t('saved'));
    } catch {
      // The alert below gives the request failure its localized text.
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

            <Field data-invalid={errors.primaryColor ? true : undefined}>
              <FieldLabel htmlFor="settings-primary-color">{t('primaryColor')}</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  aria-label={t('primaryColor')}
                  className="size-10 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
                  id="settings-primary-color-picker"
                  onChange={(event) =>
                    form.setValue('primaryColor', event.target.value.toUpperCase(), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  type="color"
                  value={primaryColor}
                />
                <Input
                  id="settings-primary-color"
                  maxLength={7}
                  spellCheck={false}
                  className="max-w-40 font-mono uppercase"
                  aria-invalid={errors.primaryColor ? true : undefined}
                  {...form.register('primaryColor')}
                />
              </div>
              <FieldError errors={[errors.primaryColor]} />
            </Field>

            <Field data-invalid={errors.secondaryColor ? true : undefined}>
              <FieldLabel htmlFor="settings-secondary-color">{t('secondaryColor')}</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  aria-label={t('secondaryColor')}
                  className="size-10 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
                  id="settings-secondary-color-picker"
                  onChange={(event) =>
                    form.setValue('secondaryColor', event.target.value.toUpperCase(), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  type="color"
                  value={secondaryColor}
                />
                <Input
                  id="settings-secondary-color"
                  maxLength={7}
                  spellCheck={false}
                  className="max-w-40 font-mono uppercase"
                  aria-invalid={errors.secondaryColor ? true : undefined}
                  {...form.register('secondaryColor')}
                />
              </div>
              <FieldError errors={[errors.secondaryColor]} />
            </Field>

            <section aria-label={t('preview')} className="flex flex-col gap-3" style={previewStyle}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('preview')}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => form.reset(DEFAULT_THEME)}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  {t('reset')}
                </Button>
              </div>
              <div aria-hidden className="overflow-hidden rounded-lg border border-border">
                <div className="h-2.5 bg-[var(--theme-preview-primary)]" />
                <div className="flex items-center gap-3 bg-card p-4">
                  <span className="size-9 rounded-md bg-[var(--theme-preview-secondary)]" />
                  <span className="h-3 w-32 rounded-sm bg-foreground/15" />
                  <span className="ml-auto h-8 w-20 rounded-md bg-[var(--theme-preview-primary)]" />
                </div>
              </div>
            </section>

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
