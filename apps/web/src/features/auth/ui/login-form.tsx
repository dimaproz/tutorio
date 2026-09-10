'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@tutorio/validation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { AuthPanel } from './auth-panel';
import { PasswordInput } from './password-input';

interface LoginFormProps {
  onSubmit: (values: LoginDto) => Promise<void>;
  requestError?: string;
  pending?: boolean;
  defaultPasswordVisible?: boolean;
}

export function LoginForm({
  onSubmit,
  requestError,
  pending = false,
  defaultPasswordVisible = false,
}: LoginFormProps) {
  const t = useTranslations('auth.login');
  const tValidation = useTranslations('validation');
  const form = useForm<LoginDto>({
    resolver: zodResolver(loginSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const submitting = pending || isSubmitting;

  return (
    <AuthPanel
      title={t('title')}
      description={t('subtitle')}
      footer={
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('registerLink')}
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
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="login-email">{t('email')}</FieldLabel>
            <Input id="login-email" type="email" autoComplete="email" inputMode="email" spellCheck={false} aria-invalid={errors.email ? true : undefined} {...form.register('email')} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor="login-password">{t('password')}</FieldLabel>
            <PasswordInput id="login-password" autoComplete="current-password" aria-invalid={errors.password ? true : undefined} defaultVisible={defaultPasswordVisible} {...form.register('password')} />
            <FieldError errors={[errors.password]} />
          </Field>
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthPanel>
  );
}
