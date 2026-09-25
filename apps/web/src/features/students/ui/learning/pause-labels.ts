'use client';

import { useTranslations } from 'next-intl';
import { isPauseReason } from '@/features/students/model/pause';

/** A pause's reason in the reader's locale: a chip's key is named, other text shown as it is. */
export function usePauseLabels() {
  const t = useTranslations('students.pause.reasons');
  return {
    reason: (value: string | null) =>
      value === null ? null : isPauseReason(value) ? t(value).toLocaleLowerCase() : value,
  };
}
