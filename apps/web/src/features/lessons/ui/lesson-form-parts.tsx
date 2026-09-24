'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { enUS, uk } from 'date-fns/locale';
import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import type { z } from 'zod';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { DateField } from '@/components/shared/date-field';
import type { EntityPickerOption } from '@/components/shared/entity-picker';
import { toast } from 'sonner';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { useTeachersQuery } from '../api';
import { durationOptions } from '../model/edit';
import { useLessonDates } from './lesson-format';

/** A lesson form: the feature schema with the localized error map; errors show on submit. */
export function useLessonForm<T extends FieldValues>(
  schema: z.ZodTypeAny,
  defaults: T,
  /** Server values the form follows once they arrive (keeps what the user already changed). */
  values?: T,
) {
  const tValidation = useTranslations('validation');
  return useForm<T>({
    // The schema's output is `T`; the resolver's generic cannot see that through `ZodTypeAny`.
    resolver: zodResolver(schema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }) as Resolver<T>,
    defaultValues: defaults as DefaultValues<T>,
    values,
    resetOptions: { keepDirtyValues: true },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
}

/**
 * Label, a custom control and its hint or error, with the ARIA wiring of
 * `TextField`, for controls that are not inputs (the date and teacher pickers).
 */
export function FieldSlot({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (a11y: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </FieldLabel>
      {children({ id, describedBy: message ? messageId : undefined, invalid: Boolean(error) })}
      {error ? (
        <FieldError
          id={messageId}
          className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium"
        >
          <AlertCircleIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={messageId} className="text-[13px] leading-[18px]">
          {hint}
        </FieldDescription>
      ) : null}
    </Field>
  );
}

/** The date picker of the lesson forms, in the studio locale. */
export function LessonDateField({
  id,
  value,
  onChange,
  onBlur,
  describedBy,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  describedBy?: string;
  invalid: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations('lessons.edit');
  const locale = useLocale();
  const dates = useLessonDates();
  return (
    <DateField
      id={id}
      value={value}
      onValueChange={onChange}
      onBlur={onBlur}
      aria-describedby={describedBy}
      invalid={invalid}
      disabled={disabled}
      placeholder={t('pickDate')}
      locale={locale === 'uk' ? uk : enUS}
      formatValue={dates.field}
    />
  );
}

/** Shows a failed request as a toast with its localized error. */
export function useErrorToast() {
  const tErrors = useTranslations('errors');
  return (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));
}

/** The duration choices as select options: "60 хв". */
export function useDurationOptions(current: number) {
  const t = useTranslations('lessons.edit');
  return durationOptions(current).map((minutes) => ({
    value: String(minutes),
    label: t('minutes', { count: minutes }),
  }));
}

/** Active teachers of the studio as picker options, with a lookup of every name by id. */
export function useTeacherOptions() {
  const teachers = useTeachersQuery({ page: 1, pageSize: 100, state: 'all' });
  return useMemo(() => {
    const items = teachers.data?.items ?? [];
    const options: EntityPickerOption[] = items
      .filter((teacher) => !teacher.deletedAt && teacher.status !== 'ARCHIVED')
      .map((teacher) => ({
        value: teacher.id,
        label: teacher.fullName,
        avatarKey: teacher.avatarKey,
      }));
    const names = new Map(items.map((teacher) => [teacher.id, teacher.fullName]));
    const avatars = new Map(items.map((teacher) => [teacher.id, teacher.avatarKey]));
    return { options, names, avatars, loading: teachers.isPending };
  }, [teachers.data, teachers.isPending]);
}
