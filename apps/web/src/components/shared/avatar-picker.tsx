'use client';

import { AVATAR_KEYS, type AvatarKeyDto } from '@tutorio/validation';
import { useTranslations } from 'next-intl';
import { EntityAvatar } from './entity-avatar';
import { cn } from '@/lib/utils';

// A row of tappable avatar options: the first cell is the "initials" fallback
// (value = null); the rest are the bundled illustrations. The selected option
// gets a brand ring.
export function AvatarPicker({
  value,
  onChange,
  fullName,
  initialsLabel,
}: {
  value: AvatarKeyDto | null;
  onChange: (next: AvatarKeyDto | null) => void;
  fullName: string;
  initialsLabel: string;
}) {
  const t = useTranslations('common');

  return (
    <div className="flex flex-wrap gap-2.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        aria-label={initialsLabel}
        title={initialsLabel}
        className={cn(
          'rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
          value === null ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
        )}
      >
        <EntityAvatar fullName={fullName || '?'} size="md" />
      </button>

      {AVATAR_KEYS.map((key, index) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          aria-label={t('avatarOption', { number: index + 1 })}
          title={t('avatarOption', { number: index + 1 })}
          className={cn(
            'rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
            value === key ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
          )}
        >
          <EntityAvatar avatarKey={key} fullName={fullName || '?'} size="md" />
        </button>
      ))}
    </div>
  );
}
