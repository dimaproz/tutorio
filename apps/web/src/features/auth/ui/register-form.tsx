'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRightIcon, Building2Icon, MailIcon, UserIcon } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { Notice } from '@/components/shared/notice';
import { TextField } from '@/components/shared/text-field';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { cn } from '@/lib/utils';
import { registerFormSchema, type RegisterFormValues } from '../model/register-form';
import { AuthPanel } from './auth-panel';

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
  const tLogin = useTranslations('auth.login');
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
  const reveal = { show: tLogin('showPassword'), hide: tLogin('hidePassword') };

  return (
    <AuthPanel
      title={t('title')}
      description={t('subtitle')}
      footer={
        <p>
          {t('haveAccount')}{' '}
          <Link
            href="/login"
            className="font-semibold text-tint-indigo-foreground no-underline hover:underline"
          >
            {t('loginLink')}
          </Link>
        </p>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm leading-5 font-medium">{t('mode')}</legend>
          <ChoiceCardGroup
            label={t('mode')}
            value={mode}
            onValueChange={(value) => form.setValue('mode', value, { shouldValidate: true })}
            options={[
              { value: 'SOLO', title: t('modeSolo'), hint: t('modeSoloHint'), icon: <UserIcon /> },
              {
                value: 'SCHOOL',
                title: t('modeSchool'),
                hint: t('modeSchoolHint'),
                icon: <Building2Icon />,
              },
            ]}
          />
        </fieldset>

        {/* The workspace name only matters for a school: a solo tutor's
            workspace is named after them. */}
        <div className={cn('grid gap-4 sm:items-start', mode === 'SCHOOL' && 'sm:grid-cols-2')}>
          <TextField
            id="register-name"
            label={t('name')}
            placeholder={t('namePlaceholder')}
            autoComplete="name"
            error={errors.name?.message}
            {...form.register('name')}
          />
          {mode === 'SCHOOL' ? (
            <TextField
              id="register-workspace"
              label={t('workspaceName')}
              autoComplete="organization"
              hint={t('workspaceNameHint')}
              error={errors.workspaceName?.message}
              {...form.register('workspaceName')}
            />
          ) : null}
        </div>

        <TextField
          id="register-email"
          label={t('email')}
          type="email"
          icon={<MailIcon />}
          placeholder={tLogin('emailPlaceholder')}
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          error={errors.email?.message}
          {...form.register('email')}
        />

        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <TextField
            id="register-password"
            label={t('password')}
            type="password"
            autoComplete="new-password"
            hint={t('passwordHint')}
            revealLabels={reveal}
            defaultRevealed={defaultPasswordVisible}
            error={errors.password?.message}
            {...form.register('password')}
          />
          <TextField
            id="register-confirm-password"
            label={t('confirmPassword')}
            type="password"
            autoComplete="new-password"
            revealLabels={reveal}
            error={errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />
        </div>

        <Button type="submit" size="xl" disabled={submitting} className="mt-1 w-full">
          {submitting ? <Spinner data-icon="inline-start" /> : null}
          {t('submit')}
          {submitting ? null : <ArrowRightIcon data-icon="inline-end" />}
        </Button>
        {requestError ? <Notice tone="danger" text={requestError} /> : null}
      </form>
    </AuthPanel>
  );
}
