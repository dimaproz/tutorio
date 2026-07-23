'use client';

import { AVATAR_KEYS, type AvatarKeyDto } from '@tutorio/validation';
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

      {AVATAR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
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
