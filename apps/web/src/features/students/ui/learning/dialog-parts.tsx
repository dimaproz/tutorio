'use client';

import type { ReactNode } from 'react';
import { InfoIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';

/** A billing dialog's form: the feature schema with the localized error map; errors show on submit. */
export function useBillingForm<T extends FieldValues>(schema: z.ZodTypeAny, defaults: T) {
  const tValidation = useTranslations('validation');
  return useForm<T>({
    // The schema's output is `T`; the resolver's generic cannot see that through `ZodTypeAny`.
    resolver: zodResolver(schema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }) as Resolver<T>,
    defaultValues: defaults as DefaultValues<T>,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
}

/** Shows a failed request as a toast with its localized error. */
export function useBillingErrorToast() {
  const tErrors = useTranslations('errors');
  return (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));
}

/** The quiet note at the start of a dialog footer: «Спочатку закриває найстаріші заняття». */
export function FooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-[18px] text-muted-foreground [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0">
      <InfoIcon aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
