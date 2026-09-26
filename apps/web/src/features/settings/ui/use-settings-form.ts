'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useForm,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { toast } from 'sonner';
import type { UpdateWorkspaceSettingsDto } from '@tutorio/validation';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateWorkspaceSettingsMutation } from '@/lib/api/workspace';
import type { GatewayError } from '@/lib/auth/client';
import { buildSettingsDto, changedSettings } from '../model/form';

/**
 * One settings page's form: the values as saved, the fields that differ,
 * «Скасувати» back to the saved values, and the save through
 * `PATCH /workspaces/current/settings` with only what changed. A refusal the
 * page explains itself (`onRefused`) keeps the values; any other failure shows
 * above the card.
 */
export function useSettingsForm<T extends FieldValues & UpdateWorkspaceSettingsDto>({
  resolver,
  initial,
  onRefused,
}: {
  /** The page's schema with the localized validation messages. */
  resolver: Resolver<T>;
  initial: T;
  /** Returns true when the page handled the refusal (e.g. the solo-mode dialog). */
  onRefused?: (error: GatewayError) => boolean;
}) {
  const t = useTranslations('settings.page');
  const tErrors = useTranslations('errors');
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateWorkspaceSettingsMutation();
  const form = useForm<T>({
    resolver,
    defaultValues: initial as DefaultValues<T>,
  });
  // The forms are a handful of fields: every one of them drives the marks.
  const values = { ...saved, ...useWatch({ control: form.control }) } as T;
  const changed = changedSettings(values, saved) as string[];

  const submit = form.handleSubmit(async (next) => {
    setError(null);
    try {
      await mutation.mutateAsync(buildSettingsDto(next, saved));
      setSaved(next);
      form.reset(next);
      toast.success(t('toast'));
    } catch (failure) {
      const gatewayError = failure as GatewayError;
      if (onRefused?.(gatewayError)) return;
      setError(tErrors(errorMessageKey(gatewayError)));
    }
  });

  const cancel = () => {
    setError(null);
    form.reset(saved);
  };

  return {
    form,
    values,
    saved,
    changed,
    isChanged: (key: keyof T & string) => changed.includes(key),
    saving: mutation.isPending,
    error,
    submit,
    cancel,
  };
}
