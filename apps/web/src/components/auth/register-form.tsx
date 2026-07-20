'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useRegisterMutation } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { registerFormSchema, type RegisterFormValues } from '@/lib/forms/schemas';
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
    defaultValues: { name: '', workspaceName: '', email: '', password: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // confirmPassword is browser-only and never sent to the API.
      await register.mutateAsync({
        name: values.name,
        workspaceName: values.workspaceName,
        email: values.email,
        password: values.password,
      });
      router.replace('/app');
    } catch {
      // Shown via register.error below.
    }
  });

  const pending = isSubmitting || register.isPending || register.isSuccess;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-balance">{t('title')}</h1>
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {register.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{tErrors(authErrorMessageKey(register.error))}</AlertDescription>
              </Alert>
            ) : null}
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
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <p>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            {t('loginLink')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
