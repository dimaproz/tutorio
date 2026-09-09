'use client';

import { useMemo, useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const FALLBACK_TIMEZONE = 'Europe/Kyiv';

/** The browser timezone, falling back to Europe/Kyiv for our main audience. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function listTimezones(): string[] {
  // supportedValuesOf is available in every browser we target; the fallback
  // keeps the field usable in older runtimes and in tests.
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported === 'function') {
    return supported('timeZone');
  }
  return [FALLBACK_TIMEZONE, 'Europe/Warsaw', 'Europe/London', 'Europe/Berlin', 'UTC'];
}

export function TimezoneCombobox({
  value,
  onChange,
  id,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timezones = useMemo(() => listTimezones(), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && 'text-muted-foreground')}>{value || placeholder}</span>
          <ChevronsUpDownIcon data-icon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {timezones.map((timezone) => (
                <CommandItem
                  key={timezone}
                  value={timezone}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn('mr-2 size-4', value === timezone ? 'opacity-100' : 'opacity-0')}
                  />
                  {timezone}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
