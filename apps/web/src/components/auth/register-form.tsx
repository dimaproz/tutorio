'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { useRegisterMutation } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { registerFormSchema, type RegisterFormValues } from '@/features/auth/model/register-form';
import { PasswordInput } from './password-input';
import { authErrorMessageKey } from './error-message';

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const tErrors = useTranslations('auth.errors');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const register = useRegisterMutation();

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
      mode: 'SOLO',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const mode = useWatch({ control: form.control, name: 'mode' });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // confirmPassword is browser-only and never sent to the API.
      await register.mutateAsync({
        name: values.name,
        // A solo tutor names no organisation: the workspace carries their name.
        workspaceName:
          values.mode === 'SOLO' ? values.name.trim() : values.workspaceName,
        email: values.email,
        password: values.password,
        mode: values.mode,
      });
      router.replace('/app');
    } catch {
      // Shown via register.error below.
    }
  });

  const pending = isSubmitting || register.isPending || register.isSuccess;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {register.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{tErrors(authErrorMessageKey(register.error))}</AlertDescription>
            </Alert>
          ) : null}
          {/* Decides whether the product ever asks "which teacher?" — stored on
              the workspace and switchable later in settings. */}
          <Field>
            {/* Caption for the group, not for one radio — hence no htmlFor. */}
            <FieldLabel>{t('mode')}</FieldLabel>
            <RadioGroup
              aria-label={t('mode')}
              value={mode}
              onValueChange={(value) =>
                form.setValue('mode', value as RegisterFormValues['mode'], {
                  shouldValidate: true,
                })
              }
            >
              <FieldLabel
                htmlFor="register-mode-solo"
                className="flex items-start gap-2 font-normal"
              >
                <RadioGroupItem id="register-mode-solo" value="SOLO" className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{t('modeSolo')}</span>
                  <span className="text-muted-foreground text-xs">{t('modeSoloHint')}</span>
                </span>
              </FieldLabel>
              <FieldLabel
                htmlFor="register-mode-school"
                className="flex items-start gap-2 font-normal"
              >
                <RadioGroupItem id="register-mode-school" value="SCHOOL" className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{t('modeSchool')}</span>
                  <span className="text-muted-foreground text-xs">{t('modeSchoolHint')}</span>
                </span>
              </FieldLabel>
            </RadioGroup>
          </Field>

          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="register-name">{t('name')}</FieldLabel>
            <Input
              id="register-name"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              {...form.register('name')}
            />
            <FieldError errors={[errors.name]} />
          </Field>
          {/* A solo tutor has no organisation to name: the workspace takes
              their own name. */}
          {mode === 'SCHOOL' ? (
            <Field data-invalid={errors.workspaceName ? true : undefined}>
              <FieldLabel htmlFor="register-workspace">{t('workspaceName')}</FieldLabel>
              <Input
                id="register-workspace"
                autoComplete="organization"
                aria-invalid={errors.workspaceName ? true : undefined}
                aria-describedby="register-workspace-hint"
                {...form.register('workspaceName')}
              />
              <FieldDescription id="register-workspace-hint">
                {t('workspaceNameHint')}
              </FieldDescription>
              <FieldError errors={[errors.workspaceName]} />
            </Field>
          ) : null}
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="register-email">{t('email')}</FieldLabel>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              aria-invalid={errors.email ? true : undefined}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor="register-password">{t('password')}</FieldLabel>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby="register-password-hint"
              {...form.register('password')}
            />
            <FieldDescription id="register-password-hint">{t('passwordHint')}</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={errors.confirmPassword ? true : undefined}>
            <FieldLabel htmlFor="register-confirm-password">{t('confirmPassword')}</FieldLabel>
            <PasswordInput
              id="register-confirm-password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? true : undefined}
              {...form.register('confirmPassword')}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
