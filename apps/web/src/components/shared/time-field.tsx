'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDownIcon, ClockIcon, KeyboardIcon, LockIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { IconButton } from '@/components/shared/icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Reads a typed start time the way a tutor types it: `1740`, `17:40`,
 * `17.40`, `930` and `9` (→ 09:00). Returns "HH:mm", or null for anything
 * that is not a time of day.
 */
export function parseTimeInput(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, '');
  if (text === '') return null;
  let hours: number;
  let minutes: number;
  const separated = text.match(/^(\d{1,2})[:.,](\d{1,2})$/);
  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
    if (separated[2]!.length === 1) minutes *= 10;
  } else if (/^\d{1,4}$/.test(text)) {
    if (text.length <= 2) {
      hours = Number(text);
      minutes = 0;
    } else {
      hours = Number(text.slice(0, text.length - 2));
      minutes = Number(text.slice(-2));
    }
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Every `step` minutes of the day from `from` o'clock, as "HH:mm". */
export function timeSteps(step: number, from = 0, to = 24): string[] {
  const out: string[] = [];
  for (let minute = from * 60; minute < to * 60; minute += step) {
    out.push(
      `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
    );
  }
  return out;
}

/** The slots the phone sheet offers: two hours before the value to four after, 30 minutes apart. */
function sheetSlots(value: string): string[] {
  const [hours] = (TIME_RE.test(value) ? value : '17:00').split(':').map(Number);
  const start = Math.min(Math.max(hours! - 2, 0), 18);
  return timeSteps(30, start, start + 6);
}

export type TimeFieldLabels = {
  /** "--:--". */
  placeholder: string;
  /** The typed row's note, "свій час". */
  custom: string;
  /** The list footer, "Можна ввести будь-який, напр. 1740". */
  typeHint: string;
  /** Names the list and the sheet, e.g. "Початок". */
  list: string;
  /** Phone sheet: its title, e.g. "Початок · чт, 1 жовтня". */
  sheetTitle?: string;
  /** Phone sheet: the note inside the big input, "можна ввести". */
  sheetTypeNote?: string;
  /** Phone sheet: "Є інше заняття в цей час". */
  busyLegend?: string;
  /** Phone sheet: "Готово". */
  done?: string;
  /** Phone sheet: the close button. */
  close?: string;
};

/**
 * The start time of a lesson: a combobox in the 52px field box. Any time can
 * be typed ("1740" → 17:40) and Enter confirms it; the list only suggests
 * 15-minute steps, scrolled to the value. A slot another lesson already
 * takes shows a warning dot and that lesson's name, and stays selectable. On
 * phones a tap opens a bottom sheet with a big input and a grid of
 * 30-minute steps. `compact` is the phone date row's narrow box, with no
 * clock. The value is "HH:mm"; a typed text that is not a time is passed on
 * as typed, so the form's schema reports it on blur.
 */
export function TimeField({
  id,
  value,
  onChange,
  onBlur,
  labels,
  busy = {},
  compact = false,
  disabled = false,
  locked = false,
  invalid = false,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  labels: TimeFieldLabels;
  /** "HH:mm" slot → the name of the lesson that already takes it. */
  busy?: Record<string, string>;
  compact?: boolean;
  disabled?: boolean;
  /** A held lesson: the value shows with a lock and cannot change. */
  locked?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  /** Names the field from elsewhere, e.g. a column header of date rows. */
  'aria-labelledby'?: string;
}) {
  const mobile = useIsMobile();
  const props = {
    id,
    value,
    onChange,
    onBlur,
    labels,
    busy,
    compact,
    disabled: disabled || locked,
    locked,
    invalid,
    describedBy,
    ariaLabel,
    labelledBy,
  };
  return mobile ? <TimeSheetField {...props} /> : <TimeComboField {...props} />;
}

type FieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  labels: TimeFieldLabels;
  busy: Record<string, string>;
  compact: boolean;
  disabled: boolean;
  locked: boolean;
  invalid: boolean;
  describedBy?: string;
  ariaLabel?: string;
  labelledBy?: string;
};

function BusyMark({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-tint-warning-foreground">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-warning" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function TimeComboField({
  id,
  value,
  onChange,
  onBlur,
  labels,
  busy,
  compact,
  disabled,
  locked,
  invalid,
  describedBy,
  ariaLabel,
  labelledBy,
}: FieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(value);
  const listRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const text = draft ?? value;
  const typed = draft !== null ? parseTimeInput(draft) : null;
  const steps = timeSteps(15);
  const custom = typed && !steps.includes(typed) ? typed : null;

  // The list opens scrolled to the value, as the board shows it.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const selected = list?.querySelector<HTMLElement>(`[data-value="${CSS.escape(active)}"]`);
      // Scrolls the list alone: scrollIntoView would move the page under it.
      if (list && selected) {
        list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
      }
    });
    return () => cancelAnimationFrame(frame);
    // Only when it opens: keyboard moves scroll on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    setDraft(null);
    setActive(next);
    setOpen(false);
  };

  const commitDraft = () => {
    if (draft === null) return;
    commit(parseTimeInput(draft) ?? draft.trim());
  };

  return (
    <Command
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      loop
      className="overflow-visible rounded-none bg-transparent p-0"
    >
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <InputGroup
            ref={anchorRef}
            size="field"
            data-disabled={disabled || undefined}
            className={cn(
              open && 'border-ring ring-3 ring-ring/16',
              invalid && 'border-destructive',
            )}
          >
            {compact ? null : (
              <InputGroupAddon align="inline-start" className="pl-4 [&>svg]:size-4.25">
                <ClockIcon aria-hidden="true" />
              </InputGroupAddon>
            )}
            {/* A plain input, not cmdk's: cmdk moves focus to its own input id
                whenever the highlighted row changes, and this one keeps the
                field's id for its label. The root still handles the arrows and
                Enter, which bubble up from here. */}
            <InputGroupInput
              id={id}
              role="combobox"
              aria-labelledby={labelledBy}
              aria-label={ariaLabel}
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              placeholder={labels.placeholder}
              value={text}
              onChange={(event) => {
                const next = event.target.value;
                setDraft(next);
                const parsed = parseTimeInput(next);
                // A full "HH:mm" is a value at once; anything shorter waits for blur.
                if (parsed) {
                  setActive(parsed);
                  if (/^\d{1,2}[:.,]\d{2}$|^\d{4}$/.test(next.trim())) onChange(parsed);
                }
                setOpen(true);
              }}
              onFocus={() => setActive(value || '17:00')}
              onClick={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') setOpen(true);
                if (event.key === 'Escape' && open) {
                  event.stopPropagation();
                  setDraft(null);
                  setOpen(false);
                }
                if (event.key === 'Enter' && !open) commitDraft();
              }}
              onBlur={(event) => {
                // Focus moving into the list is not leaving the field.
                const next = event.relatedTarget as Node | null;
                if (next && listRef.current?.parentElement?.contains(next)) return;
                commitDraft();
                setOpen(false);
                onBlur?.();
              }}
              className={cn(
                'h-full font-mono text-[15px] md:text-[15px]',
                compact ? 'pl-4' : 'pl-2.5',
                'pr-1',
              )}
            />
            <InputGroupAddon align="inline-end" className="pr-3.5">
              {locked ? (
                <LockIcon aria-hidden="true" className="size-3.75" />
              ) : (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setOpen((current) => !current)}
                  className="flex text-muted-foreground"
                >
                  <ChevronDownIcon className="size-4" />
                </button>
              )}
            </InputGroupAddon>
          </InputGroup>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          aria-label={labels.list}
          className="w-60 gap-0 rounded-row p-1.5 shadow-menu"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // A press on the field itself keeps the list open.
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          // Keep the typing in the field: a press in the list must not blur it.
          onMouseDown={(event) => event.preventDefault()}
        >
          {/* The wrapper scrolls and takes focus: cmdk pins its list at tabindex -1. */}
          <div
            ref={listRef}
            id={listId}
            tabIndex={0}
            className="no-scrollbar relative max-h-73 overflow-y-auto outline-none [mask-image:linear-gradient(to_bottom,black_85%,transparent)]"
          >
            <CommandList label={labels.list} className="max-h-none overflow-visible">
              {custom ? (
                <CommandGroup className="border-b border-border p-0 pb-1.5">
                  <CommandItem value={custom} onSelect={() => commit(custom)}>
                    <span className="font-mono font-semibold">{custom}</span>
                    <span className="text-xs text-muted-foreground">{labels.custom}</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup className="p-0 pt-1">
                {steps.map((slot) => (
                  <CommandItem
                    key={slot}
                    value={slot}
                    data-checked={slot === value}
                    onSelect={() => commit(slot)}
                    className="gap-2.5 font-normal data-[checked=true]:font-medium"
                  >
                    <span className="font-mono">{slot}</span>
                    {busy[slot] ? <BusyMark label={busy[slot]!} /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </div>
          <div className="mt-1 flex items-center gap-2 border-t border-border px-3 pt-2.5 pb-1.5 text-xs text-muted-foreground">
            <KeyboardIcon aria-hidden="true" className="size-3.5 shrink-0" />
            {labels.typeHint}
          </div>
        </PopoverContent>
      </Popover>
    </Command>
  );
}

/** The phone variant: the box opens a sheet with a big input and a grid of steps. */
function TimeSheetField({
  id,
  value,
  onChange,
  onBlur,
  labels,
  busy,
  compact,
  disabled,
  locked,
  invalid,
  describedBy,
  ariaLabel,
  labelledBy,
}: FieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const slots = sheetSlots(value);
  const parsed = parseTimeInput(draft);

  const close = (next: boolean) => {
    setOpen(next);
    if (next) setDraft(value);
    else onBlur?.();
  };
  const done = () => {
    onChange(parsed ?? draft.trim());
    close(false);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-haspopup="dialog"
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        data-placeholder={value ? undefined : ''}
        onClick={() => close(true)}
        className={cn(
          'flex h-13 w-full min-w-0 items-center gap-2.5 rounded-field border border-border bg-card px-4 text-left font-mono text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/16 data-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground data-placeholder:text-muted-foreground',
          compact && 'justify-between gap-1 px-3',
        )}
      >
        {compact ? null : (
          <ClockIcon aria-hidden="true" className="size-4.25 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 grow truncate">{value || labels.placeholder}</span>
        {locked ? (
          <LockIcon aria-hidden="true" className="size-3.75 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      <Drawer open={open} onOpenChange={close}>
        <DrawerContent>
          <DrawerHeader className="flex-row items-center gap-3 px-4 pt-4 pb-0 text-left">
            <DrawerTitle className="min-w-0 grow truncate text-lg leading-6 font-semibold">
              {labels.sheetTitle ?? labels.list}
            </DrawerTitle>
            <DrawerDescription className="sr-only">{labels.typeHint}</DrawerDescription>
            <IconButton
              icon={<XIcon />}
              label={labels.close ?? labels.done ?? ''}
              size={38}
              tone="paper"
              onClick={() => close(false)}
            />
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pt-4">
            <InputGroup size="field" className="h-14 border-ring ring-3 ring-ring/16">
              <InputGroupAddon align="inline-start" className="pl-4 [&>svg]:size-4.5">
                <ClockIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={labels.list}
                inputMode="numeric"
                autoComplete="off"
                value={draft}
                placeholder={labels.placeholder}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') done();
                }}
                className="h-full pl-2.5 font-mono text-2xl font-semibold md:text-2xl"
              />
              {labels.sheetTypeNote ? (
                <InputGroupAddon align="inline-end" className="pr-4 text-xs font-normal">
                  {labels.sheetTypeNote}
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <div role="listbox" aria-label={labels.list} className="grid grid-cols-4 gap-2">
              {slots.map((slot) => {
                const selected = slot === (parsed ?? value);
                const taken = Boolean(busy[slot]);
                return (
                  <button
                    key={slot}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setDraft(slot)}
                    className={cn(
                      'relative h-11 rounded-item font-mono text-[15px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-ring',
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : taken
                          ? 'bg-tint-warning text-tint-warning-foreground'
                          : 'bg-background text-foreground',
                    )}
                  >
                    {slot}
                    {taken ? <span className="sr-only">{` · ${busy[slot]}`}</span> : null}
                    {taken && !selected ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-1.5 right-1.5 size-1.5 rounded-pill bg-warning"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {labels.busyLegend && Object.keys(busy).length > 0 ? (
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span aria-hidden="true" className="size-2 rounded-pill bg-warning" />
                {labels.busyLegend}
              </span>
            ) : null}
          </div>
          <DrawerFooter className="px-4 pt-4">
            <Button type="button" onClick={done}>
              {labels.done}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
