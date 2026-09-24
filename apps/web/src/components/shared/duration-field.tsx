'use client';

import { useRef, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** The durations the list and the phone chips offer, in minutes. */
export const POPULAR_DURATIONS = [30, 45, 60, 90, 120] as const;

export type DurationFieldLabels = {
  /** The unit after the number, "хв". */
  unit: string;
  /** The list's section, "Популярні". */
  popular: string;
  /** Names the list, e.g. "Тривалість". */
  list: string;
  /** "60 хв". */
  minutes: (minutes: number) => string;
  /** The note after a duration, "1 год", "1,5 год"; empty under an hour. */
  hours: (minutes: number) => string;
  /** The chip on the usual duration, "як зазвичай". */
  usual?: string;
};

/**
 * A lesson length in minutes: a number in the 52px field box with the unit,
 * a divider and a list of popular lengths (30, 45, 60, 90, 120). Any number
 * can be typed; a typed length that is not in the list becomes its first
 * row. `usual` marks the student's or group's usual length. On phones the
 * list is replaced by quick chips under the field. The caller validates the
 * range and supplies the hint ("1 год · до 18:00").
 */
export function DurationField({
  id,
  value,
  onChange,
  onBlur,
  labels,
  usual,
  disabled = false,
  invalid = false,
  'aria-describedby': describedBy,
}: {
  id?: string;
  /** Minutes as typed, e.g. "60". */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  labels: DurationFieldLabels;
  usual?: number | null;
  disabled?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
}) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const anchorRef = useRef<HTMLDivElement>(null);
  const typed = Number(value);
  const custom =
    value.trim() !== '' &&
    Number.isInteger(typed) &&
    typed > 0 &&
    !(POPULAR_DURATIONS as readonly number[]).includes(typed)
      ? typed
      : null;

  const pick = (minutes: number) => {
    onChange(String(minutes));
    setActive(String(minutes));
    setOpen(false);
  };

  const row = (minutes: number) => (
    <CommandItem
      key={minutes}
      value={String(minutes)}
      data-checked={String(minutes) === value}
      onSelect={() => pick(minutes)}
      className="gap-2 font-normal data-[checked=true]:font-medium"
    >
      <span>{labels.minutes(minutes)}</span>
      {labels.hours(minutes) ? (
        <span className="text-xs text-muted-foreground">{labels.hours(minutes)}</span>
      ) : null}
      {usual === minutes && labels.usual ? (
        <Badge variant="indigo" size="sm" className="px-2 text-[11px] font-semibold">
          {labels.usual}
        </Badge>
      ) : null}
    </CommandItem>
  );

  const box = (
    <InputGroup
      ref={anchorRef}
      size="field"
      data-disabled={disabled || undefined}
      className={cn(open && 'border-ring ring-3 ring-ring/16')}
    >
      <InputGroupInput
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-expanded={mobile ? undefined : open}
        role={mobile ? undefined : 'combobox'}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, 3);
          onChange(next);
          if (next) setActive(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        className="h-full pr-1.5 pl-4 text-[15px] md:text-[15px]"
      />
      <InputGroupAddon align="inline-end" className="gap-0 pr-2">
        <span className="pr-3 text-[15px] font-normal text-muted-foreground">{labels.unit}</span>
        {mobile ? null : (
          <>
            <span aria-hidden="true" className="h-6 w-px bg-border" />
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen((current) => !current)}
              className="flex h-9 w-8 items-center justify-center text-muted-foreground"
            >
              <ChevronDownIcon className="size-4" />
            </button>
          </>
        )}
      </InputGroupAddon>
    </InputGroup>
  );

  if (mobile) {
    return (
      <div className="flex flex-col gap-2.5">
        {box}
        <ToggleGroup
          type="single"
          aria-label={labels.list}
          value={(POPULAR_DURATIONS as readonly number[]).includes(typed) ? value : ''}
          onValueChange={(next) => {
            if (next) onChange(next);
          }}
          disabled={disabled}
          className="flex-wrap gap-2"
        >
          {POPULAR_DURATIONS.map((minutes) => (
            <ToggleGroupItem
              key={minutes}
              value={String(minutes)}
              aria-label={labels.minutes(minutes)}
              className="h-9 min-w-12 rounded-pill bg-background px-3 text-[13px] font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {minutes}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  }

  return (
    <Command
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      loop
      className="overflow-visible rounded-none bg-transparent p-0"
      onKeyDownCapture={(event) => {
        // The list takes the arrows and Enter only while it is open.
        if (!open && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
          if (event.key !== 'Enter') setOpen(true);
          event.stopPropagation();
        }
      }}
    >
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverAnchor asChild>{box}</PopoverAnchor>
        <PopoverContent
          align="start"
          aria-label={labels.list}
          className="w-(--radix-popover-trigger-width) min-w-60 gap-0 rounded-row p-1.5 shadow-menu"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <CommandList label={labels.list}>
            {custom ? (
              <CommandGroup className="border-b border-border p-0 pb-1.5">
                {row(custom)}
              </CommandGroup>
            ) : null}
            <CommandGroup
              heading={labels.popular}
              className="p-0 pt-1 **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-[0.04em] **:[[cmdk-group-heading]]:uppercase"
            >
              {POPULAR_DURATIONS.map(row)}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  );
}
