'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { registerFormSchema, type RegisterFormValues } from '../model/register-form';
import { AuthPanel } from './auth-panel';
import { PasswordInput } from './password-input';

interface RegisterFormProps {
  onSubmit: (values: RegisterFormValues) => Promise<void>;
  requestError?: string;
  pending?: boolean;
  defaultMode?: RegisterFormValues['mode'];
  defaultPasswordVisible?: boolean;
}

export function RegisterForm({
  onSubmit,
  requestError,
  pending = false,
  defaultMode = 'SOLO',
  defaultPasswordVisible = false,
}: RegisterFormProps) {
  const t = useTranslations('auth.register');
  const tValidation = useTranslations('validation');
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: {
      name: '',
      workspaceName: '',
      email: '',
      password: '',
      confirmPassword: '',
      mode: defaultMode,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const mode = useWatch({ control: form.control, name: 'mode' });
  const submitting = pending || isSubmitting;

  return (
    <AuthPanel
      title={t('title')}
      description={t('subtitle')}
      footer={
        <p className="text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('loginLink')}
          </Link>
        </p>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          {requestError ? (
            <Alert variant="destructive">
              <AlertDescription>{requestError}</AlertDescription>
            </Alert>
          ) : null}
          <FieldSet>
            <FieldLegend>{t('mode')}</FieldLegend>
            <RadioGroup
              aria-label={t('mode')}
              value={mode}
              onValueChange={(value) => form.setValue('mode', value as RegisterFormValues['mode'], { shouldValidate: true })}
            >
              <Field orientation="horizontal">
                <RadioGroupItem id="register-mode-solo" value="SOLO" />
                <FieldContent>
                  <FieldLabel htmlFor="register-mode-solo">{t('modeSolo')}</FieldLabel>
                  <FieldDescription>{t('modeSoloHint')}</FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem id="register-mode-school" value="SCHOOL" />
                <FieldContent>
                  <FieldLabel htmlFor="register-mode-school">{t('modeSchool')}</FieldLabel>
                  <FieldDescription>{t('modeSchoolHint')}</FieldDescription>
                </FieldContent>
              </Field>
            </RadioGroup>
          </FieldSet>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="register-name">{t('name')}</FieldLabel>
            <Input id="register-name" autoComplete="name" aria-invalid={errors.name ? true : undefined} {...form.register('name')} />
            <FieldError errors={[errors.name]} />
          </Field>
          {mode === 'SCHOOL' ? (
            <Field data-invalid={errors.workspaceName ? true : undefined}>
              <FieldLabel htmlFor="register-workspace">{t('workspaceName')}</FieldLabel>
              <Input id="register-workspace" autoComplete="organization" aria-invalid={errors.workspaceName ? true : undefined} aria-describedby="register-workspace-hint" {...form.register('workspaceName')} />
              <FieldDescription id="register-workspace-hint">{t('workspaceNameHint')}</FieldDescription>
              <FieldError errors={[errors.workspaceName]} />
            </Field>
          ) : null}
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="register-email">{t('email')}</FieldLabel>
            <Input id="register-email" type="email" autoComplete="email" inputMode="email" spellCheck={false} aria-invalid={errors.email ? true : undefined} {...form.register('email')} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor="register-password">{t('password')}</FieldLabel>
            <PasswordInput id="register-password" autoComplete="new-password" aria-invalid={errors.password ? true : undefined} aria-describedby="register-password-hint" defaultVisible={defaultPasswordVisible} {...form.register('password')} />
            <FieldDescription id="register-password-hint">{t('passwordHint')}</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={errors.confirmPassword ? true : undefined}>
            <FieldLabel htmlFor="register-confirm-password">{t('confirmPassword')}</FieldLabel>
            <PasswordInput id="register-confirm-password" autoComplete="new-password" aria-invalid={errors.confirmPassword ? true : undefined} {...form.register('confirmPassword')} />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthPanel>
  );
}
