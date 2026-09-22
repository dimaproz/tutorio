'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRightIcon, LockIcon, MailIcon } from 'lucide-react';
import { loginSchema, type LoginDto } from '@tutorio/validation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Notice } from '@/components/shared/notice';
import { TextField } from '@/components/shared/text-field';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { AuthPanel } from './auth-panel';

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
        <p>
          {t('noAccount')}{' '}
          <Link
            href="/register"
            className="font-semibold text-tint-indigo-foreground no-underline hover:underline"
          >
            {t('registerLink')}
          </Link>
        </p>
      }
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4.5 md:gap-5"
      >
        <TextField
          id="login-email"
          label={t('email')}
          type="email"
          icon={<MailIcon />}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          error={errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          id="login-password"
          label={t('password')}
          type="password"
          icon={<LockIcon />}
          autoComplete="current-password"
          revealLabels={{ show: t('showPassword'), hide: t('hidePassword') }}
          defaultRevealed={defaultPasswordVisible}
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" size="xl" disabled={submitting} className="mt-1.5 w-full md:mt-2">
          {submitting ? <Spinner data-icon="inline-start" /> : null}
          {t('submit')}
          {submitting ? null : <ArrowRightIcon data-icon="inline-end" />}
        </Button>
        {requestError ? <Notice tone="danger" text={requestError} /> : null}
      </form>
    </AuthPanel>
  );
}
