import * as React from 'react';
import { Input } from '@/components/ui/input';

// Keep a price field to a valid money string as the user types: digits, one
// decimal separator (either "," or "."), at most two decimals. Letters and
// stray separators are refused outright rather than failing validation later.
export function sanitizeAmount(raw: string): string {
  let value = raw.replace(/[^\d.,]/g, '');
  const sepIndex = value.search(/[.,]/);
  if (sepIndex !== -1) {
    const sep = value[sepIndex];
    const intPart = value.slice(0, sepIndex);
    const decPart = value
      .slice(sepIndex + 1)
      .replace(/[.,]/g, '')
      .slice(0, 2);
    value = intPart + sep + decPart;
  }
  return value;
}

// The single money entry field — reuse everywhere a price is typed so the
// "no letters in price" rule lives in exactly one place. Works with
// react-hook-form: spread `{...form.register('price')}` onto it; the register's
// onChange is wrapped to sanitise before RHF sees the value.
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(function MoneyInput({ onChange, ...props }, ref) {
  return (
    <Input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      onChange={(event) => {
        event.target.value = sanitizeAmount(event.target.value);
        onChange?.(event);
      }}
      {...props}
    />
  );
});
