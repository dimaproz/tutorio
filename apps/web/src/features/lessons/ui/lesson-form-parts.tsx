'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import type { z } from 'zod';
import type { EntityPickerOption } from '@/components/shared/entity-picker';
import { toast } from 'sonner';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { TEACHER_OPTIONS_FILTERS, useTeachersQuery } from '../api';

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

/** Shows a failed request as a toast with its localized error. */
export function useErrorToast() {
  const tErrors = useTranslations('errors');
  return (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));
}

/** Active teachers of the studio as picker options, with a lookup of every name by id. */
export function useTeacherOptions() {
  const teachers = useTeachersQuery(TEACHER_OPTIONS_FILTERS);
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
