'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@tutorio/validation';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useLoginMutation } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { PasswordInput } from './password-input';
import { authErrorMessageKey } from './error-message';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const tErrors = useTranslations('auth.errors');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const login = useLoginMutation();

  const form = useForm<LoginDto>({
    resolver: zodResolver(loginSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace('/app');
    } catch {
      // Shown via login.error below.
    }
  });

  const pending = isSubmitting || login.isPending || login.isSuccess;

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
            {login.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{tErrors(authErrorMessageKey(login.error))}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="login-email">{t('email')}</FieldLabel>
              <Input
                id="login-email"
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
              <FieldLabel htmlFor="login-password">{t('password')}</FieldLabel>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                {...form.register('password')}
              />
              <FieldError errors={[errors.password]} />
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
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
            {t('registerLink')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
