'use client';

import type { ReactNode } from 'react';
import { InfoIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  Controller,
  useForm,
  type Control,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { DateField } from '@/components/shared/date-field';
import { Segmented } from '@/components/shared/segmented';
import { FieldFrame } from '@/components/shared/text-field';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { useDateFnsLocale } from '@/lib/i18n/format';
import { METHODS } from '../model/operations';
import type { PackageFormat } from './use-package-format';

/** A package form: the feature schema with the localized error map; errors show on submit. */
export function usePackageForm<T extends FieldValues>(schema: z.ZodTypeAny, defaults: T) {
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
export function useErrorToast() {
  const tErrors = useTranslations('errors');
  return (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));
}

/** The quiet note at the start of a dialog footer. */
export function FooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-[18px] text-muted-foreground [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0">
      <InfoIcon aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** A "yyyy-MM-dd" field of a form as the calendar date field. */
export function DayField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  format,
  labelAction,
  disabled,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: ReactNode;
  format: PackageFormat;
  labelAction?: ReactNode;
  disabled?: boolean;
}) {
  const locale = useDateFnsLocale();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldFrame
          label={label}
          hint={hint}
          labelAction={labelAction}
          error={fieldState.error?.message}
        >
          {(a11y) => (
            <DateField
              id={a11y.id}
              aria-describedby={a11y.describedBy}
              invalid={Boolean(a11y.invalid)}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              formatValue={format.field}
              placeholder={label}
              locale={locale}
              disabled={disabled}
            />
          )}
        </FieldFrame>
      )}
    />
  );
}

/** «Спосіб»: transfer, cash or other, transfer first (decision 7). */
export function MethodField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const t = useTranslations('packages.methods');
  const tField = useTranslations('packages.dialogs');
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-5 font-medium">{tField('method')}</span>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Segmented
            label={tField('method')}
            variant="paper"
            className="w-fit"
            value={field.value}
            onValueChange={field.onChange}
            items={METHODS.map((method) => ({ value: method, label: t(method) }))}
          />
        )}
      />
    </div>
  );
}
