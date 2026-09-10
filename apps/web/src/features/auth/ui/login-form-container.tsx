'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLoginMutation } from '@/lib/auth/client';
import { authErrorMessageKey } from '../model/error-message';
import { LoginForm } from './login-form';

export function LoginFormContainer() {
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const login = useLoginMutation();

  return <LoginForm requestError={login.error ? tErrors(authErrorMessageKey(login.error)) : undefined} pending={login.isPending || login.isSuccess} onSubmit={async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace('/app');
    } catch {
      // The mutation error is rendered by the visual form without clearing its inputs.
    }
  }} />;
}
