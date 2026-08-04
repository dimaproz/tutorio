'use client';

import { useTranslations } from 'next-intl';
import { PresetNumberInput } from './preset-number-input';

export const POPULAR_DURATIONS = [30, 45, 60, 90, 120] as const;

/**
 * A numeric duration field with common lesson lengths one click away. The
 * regular input remains editable, so uncommon durations never need a special
 * "other" path.
 */
export function DurationInput({
  id,
  value,
  onValueChange,
  onBlur,
  invalid = false,
  disabled = false,
  min = 5,
  max = 720,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  const t = useTranslations('common');
  return (
    <PresetNumberInput
      id={id}
      value={value}
      onValueChange={onValueChange}
      onBlur={onBlur}
      presets={POPULAR_DURATIONS}
      formatPreset={(minutes) => t('durationMinutes', { minutes })}
      hint={t('durationChoiceHint')}
      invalid={invalid}
      disabled={disabled}
      min={min}
      max={max}
    />
  );
}
