'use client';

import type { ComponentProps } from 'react';
import { SearchIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

/**
 * The global search pill in the top bar: a leading search glyph and an optional
 * trailing shortcut hint. All copy is supplied by the caller.
 */
export function SearchField({
  label,
  placeholder,
  shortcut,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & {
  /** Accessible name; the field has no visible label. */
  label: string;
  shortcut?: string;
}) {
  return (
    <InputGroup className={cn('w-full', className)}>
      <InputGroupAddon align="inline-start">
        <SearchIcon aria-hidden="true" className="size-4.5" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={placeholder}
        className="text-sm text-foreground"
        {...props}
      />
      {shortcut ? (
        <InputGroupAddon align="inline-end">
          <Kbd>{shortcut}</Kbd>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
