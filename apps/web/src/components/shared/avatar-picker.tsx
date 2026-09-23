'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import { AVATAR_KEYS, type AvatarKeyDto } from '@tutorio/validation';
import { useTranslations } from 'next-intl';
import { EntityAvatar } from './entity-avatar';
import { cn, nameInitials } from '@/lib/utils';

type AvatarValue = AvatarKeyDto | null;

const OPTION_CLASS =
  'size-10 shrink-0 overflow-hidden rounded-pill outline-none transition-[translate,box-shadow] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55';

/**
 * The avatar choice: a 72px preview of the current pick beside a radio row of
 * the initials tile and the bundled illustrations. Arrow keys move through
 * the options the way a native radio group does.
 */
export function AvatarPicker({
  value,
  onChange,
  fullName,
  initialsLabel,
  label,
  layout = 'row',
  disabled = false,
}: {
  value: AvatarValue;
  onChange: (next: AvatarValue) => void;
  fullName: string;
  initialsLabel: string;
  /** Visible group label, e.g. "Avatar". */
  label: string;
  layout?: 'row' | 'stack';
  disabled?: boolean;
}) {
  const t = useTranslations('common');
  const groupRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const options: AvatarValue[] = [null, ...AVATAR_KEYS];
  const initials = nameInitials(fullName || '?');

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const nextIndex = (options.indexOf(value) + step + options.length) % options.length;
    onChange(options[nextIndex]);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[nextIndex]?.focus();
  };

  return (
    <div
      data-slot="avatar-picker"
      className={cn(
        'flex w-full text-foreground',
        layout === 'stack' ? 'flex-col items-start gap-3.5' : 'items-center gap-5',
      )}
    >
      {value ? (
        <EntityAvatar avatarKey={value} fullName={fullName || '?'} className="size-18" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-18 shrink-0 items-center justify-center rounded-pill bg-tint-indigo text-2xl font-semibold text-tint-indigo-foreground"
        >
          {initials}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-2.5">
        <span id={labelId} className="text-sm leading-5 font-medium">
          {label}
        </span>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-labelledby={labelId}
          onKeyDown={onKeyDown}
          className="flex flex-wrap gap-2"
        >
          {options.map((option, index) => {
            const checked = option === value;
            return (
              <button
                key={option ?? 'initials'}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={option ? t('avatarOption', { number: index }) : initialsLabel}
                title={option ? t('avatarOption', { number: index }) : initialsLabel}
                tabIndex={checked ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(option)}
                className={cn(
                  OPTION_CLASS,
                  option
                    ? 'bg-background'
                    : 'flex items-center justify-center bg-tile-indigo text-sm font-semibold text-tile-indigo-foreground',
                  checked
                    ? 'ring-2 ring-brand ring-offset-2 ring-offset-card'
                    : 'not-disabled:hover:-translate-y-0.5 not-disabled:hover:ring-2 not-disabled:hover:ring-line-hover not-disabled:hover:ring-offset-2 not-disabled:hover:ring-offset-card',
                )}
              >
                {option ? (
                  <EntityAvatar avatarKey={option} fullName={fullName || '?'} className="size-10" />
                ) : (
                  initials
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
