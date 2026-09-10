'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRegisterMutation } from '@/lib/auth/client';
import { authErrorMessageKey } from '../model/error-message';
import { RegisterForm } from './register-form';

export function RegisterFormContainer() {
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const register = useRegisterMutation();

  return <RegisterForm requestError={register.error ? tErrors(authErrorMessageKey(register.error)) : undefined} pending={register.isPending || register.isSuccess} onSubmit={async (values) => {
    try {
      await register.mutateAsync({
        name: values.name,
        workspaceName: values.mode === 'SOLO' ? values.name.trim() : values.workspaceName,
        email: values.email,
        password: values.password,
        mode: values.mode,
      });
      router.replace('/app');
    } catch {
      // The mutation error is rendered by the visual form without clearing its inputs.
    }
  }} />;
}
