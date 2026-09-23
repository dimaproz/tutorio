import type { UseFormRegisterReturn } from 'react-hook-form';

/** Keeps what a phone number may contain: digits, spaces and + ( ) -. */
export function keepPhoneCharacters(value: string): string {
  return value.replace(/[^\d\s()+-]/g, '');
}

/** A Telegram username as typed after the fixed "@": word characters only. */
export function keepTelegramCharacters(value: string): string {
  return value.replace(/^@+/, '').replace(/[^\w]/g, '');
}

/**
 * A registration whose input is cleaned before react-hook-form reads it.
 * The `onChange` option of `register` runs after the value has been stored,
 * so a filter passed there changes only what the input shows, not what is
 * submitted or compared for dirtiness.
 */
export function filteredRegistration<TName extends string>(
  registration: UseFormRegisterReturn<TName>,
  filter: (value: string) => string,
): UseFormRegisterReturn<TName> {
  return {
    ...registration,
    onChange: (event: { target: { value: string } }) => {
      event.target.value = filter(event.target.value);
      return registration.onChange(event);
    },
  };
}
