'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fieldBoxClass } from '@/components/shared/text-field';

export const FALLBACK_TIMEZONE = 'Europe/Kyiv';

/** The browser timezone, falling back to Europe/Kyiv for our main audience. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/**
 * The zones a tutor and their students actually live in, west to east. The
 * full IANA database has ~400 entries, which buries the few that matter.
 */
export const MAIN_TIMEZONES = [
  'America/Los_Angeles',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'UTC',
  'Europe/London',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Chisinau',
  'Europe/Helsinki',
  'Europe/Kyiv',
  'Europe/Sofia',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Tbilisi',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

/**
 * The main zones, led by any zone outside them that must stay selectable: the
 * saved value of an existing record and the browser's own zone.
 */
export function listTimezones(...keep: (string | undefined)[]): string[] {
  const main: readonly string[] = MAIN_TIMEZONES;
  const extra = keep.filter(
    (zone, index): zone is string =>
      Boolean(zone) && !main.includes(zone as string) && keep.indexOf(zone) === index,
  );
  return [...extra, ...main];
}

// Offsets are read once per zone per session: building a formatter for every
// zone on every render would stall the list as it opens.
const offsetCache = new Map<string, string>();

/** The zone's current UTC offset as the browser names it, e.g. "GMT+3". */
export function timezoneOffsetLabel(timezone: string, at?: Date): string {
  if (!at && offsetCache.has(timezone)) return offsetCache.get(timezone) ?? '';
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(at ?? new Date())
      .find((item) => item.type === 'timeZoneName');
    const label = part?.value ?? '';
    if (!at) offsetCache.set(timezone, label);
    return label;
  } catch {
    return '';
  }
}

/**
 * The searchable timezone field. The trigger is a form field box; the list
 * shows each zone with its current offset and checks the selected one.
 */
export function TimezoneCombobox({
  value,
  onChange,
  id,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  invalid = false,
  describedBy,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  invalid?: boolean;
  /** Id of the hint or error that describes the field. */
  describedBy?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const timezones = useMemo(() => listTimezones(value, detectTimezone()), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(fieldBoxClass, 'justify-between')}
        >
          <SearchIcon aria-hidden="true" className="size-4.5 text-muted-foreground" />
          <span className={cn('min-w-0 grow truncate', !value && 'text-muted-foreground')}>
            {value ? `${value} · ${timezoneOffsetLabel(value)}` : placeholder}
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-4.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      {/* The popover is a dialog to assistive tech, so it needs a name. */}
      <PopoverContent
        id={listId}
        aria-label={placeholder}
        className="w-(--radix-popover-trigger-width) p-1.5"
        align="start"
      >
        <Command className="bg-transparent p-0">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {timezones.map((timezone) => (
                <CommandItem
                  key={timezone}
                  value={timezone}
                  data-checked={value === timezone}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                  }}
                  className="justify-between gap-3"
                >
                  <span className="truncate">{timezone}</span>
                  {value === timezone ? null : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {timezoneOffsetLabel(timezone)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
