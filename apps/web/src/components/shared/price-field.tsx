'use client';

import type { ReactNode } from 'react';
import { TextField } from '@/components/shared/text-field';

export type PriceFieldState = 'amount' | 'locked' | 'package' | 'empty';

/**
 * A lesson price in the 52px field box, with the currency after it. The
 * states follow the lesson form's price board:
 *
 * - `amount` — an editable price (the rate, one typed by hand, a group price);
 * - `locked` — a price that can no longer change (a paid lesson), with a lock;
 * - `package` — no money at all: `packageLabel` ("1 заняття з пакета") with
 *   the brand package icon and a lock (L-12: a package lesson costs a credit);
 * - `empty` — nothing to show yet ("—"), until the student is picked.
 *
 * The label row can carry an action ("Повернути ставку") or a badge
 * ("Оновлено"); the hint and the error are the caller's copy.
 */
export function PriceField({
  id,
  label,
  labelAction,
  hint,
  error,
  state = 'amount',
  value,
  onChange,
  onBlur,
  currency,
  packageLabel,
  packageIcon,
  name,
  disabled,
  autoFocus,
}: {
  id?: string;
  label: ReactNode;
  labelAction?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  state?: PriceFieldState;
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  /** The currency sign, e.g. "₴". */
  currency: string;
  /** The `package` state's value. */
  packageLabel?: string;
  /** The `package` state's icon. */
  packageIcon?: ReactNode;
  name?: string;
  disabled?: boolean;
  /** Focuses the field with its value selected, ready to be typed over. */
  autoFocus?: boolean;
}) {
  if (state === 'package') {
    return (
      <TextField
        id={id}
        label={label}
        labelAction={labelAction}
        hint={hint}
        icon={<span className="flex text-brand [&_svg]:size-4.5">{packageIcon}</span>}
        value={packageLabel ?? ''}
        readOnly
        locked
      />
    );
  }
  return (
    <TextField
      id={id}
      name={name}
      label={label}
      labelAction={labelAction}
      hint={hint}
      error={error}
      inputMode="decimal"
      suffix={currency}
      value={state === 'empty' ? '—' : value}
      readOnly={state === 'empty'}
      disabled={state === 'empty' || disabled}
      autoFocus={autoFocus}
      onFocus={autoFocus ? (event) => event.currentTarget.select() : undefined}
      locked={state === 'locked'}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={onBlur}
    />
  );
}
