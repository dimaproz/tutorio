'use client';

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Command as CommandPrimitive } from 'cmdk';
import { ChevronDownIcon, LockIcon, SearchIcon, SearchXIcon, XIcon } from 'lucide-react';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { IconButton } from '@/components/shared/icon-button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tiles: who the lesson is for
// ---------------------------------------------------------------------------

export type WhoTileOption<T extends string> = {
  value: T;
  title: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
};

/**
 * «Учень / Група» as two tiles that act as tabs: a radio group; the chosen
 * tile is ink with a soft shadow, the other white with an indigo icon tile.
 */
export function WhoTiles<T extends string>({
  value,
  onValueChange,
  options,
  label,
  disabled,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: WhoTileOption<T>[];
  /** Accessible name of the group, "Для кого заняття". */
  label: string;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      disabled={disabled}
      className="grid-cols-2 gap-2.5"
    >
      {options.map((option) => (
        <WhoTile key={option.value} option={option} selected={option.value === value} />
      ))}
    </RadioGroup>
  );
}

function WhoTile<T extends string>({
  option,
  selected,
}: {
  option: WhoTileOption<T>;
  selected: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      data-selected={selected}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-3 rounded-row px-3.5 py-3 transition-[background-color,box-shadow] duration-150 ease-out has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        selected ? 'bg-primary text-primary-foreground shadow-lift' : 'bg-card text-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-item [&_svg]:size-5',
          selected
            ? 'bg-primary-foreground/16 text-primary-foreground'
            : 'bg-tile-indigo text-tile-indigo-foreground',
        )}
      >
        {option.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[15px] leading-5 font-semibold">{option.title}</span>
        {option.hint ? (
          <span
            className={cn(
              'truncate text-xs leading-4',
              selected ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            {option.hint}
          </span>
        ) : null}
      </span>
      <RadioGroupItem id={id} value={option.value} className="sr-only" />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Nothing picked yet
// ---------------------------------------------------------------------------

/**
 * The empty pick: a white card with a dashed brand border, a search tile,
 * «Оберіть учня» and a subline; a click opens the search in its place. The
 * error state turns the border red and names what is missing under it.
 */
export function WhoEmptyCard({
  id,
  title,
  hint,
  error,
  onOpen,
}: {
  id?: string;
  title: string;
  hint?: ReactNode;
  error?: ReactNode;
  onOpen: () => void;
}) {
  const generated = useId();
  const messageId = `${id ?? generated}-message`;
  return (
    <div className="flex flex-col gap-2">
      <button
        id={id}
        type="button"
        onClick={onOpen}
        data-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
        className={cn(
          'flex w-full items-center gap-3.5 rounded-row border-[1.5px] border-dashed bg-card p-4 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          error ? 'border-destructive' : 'border-brand/40 hover:border-brand/70',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-5"
        >
          <SearchIcon />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate text-base leading-[22px] font-semibold">{title}</span>
          {hint ? (
            <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-4.5 shrink-0 text-muted-foreground" />
      </button>
      {error ? (
        <span
          id={messageId}
          className="text-[13px] leading-[18px] font-medium text-destructive"
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type WhoSearchItem = {
  value: string;
  title: string;
  subtitle?: ReactNode;
  media: ReactNode;
  /** The billing badge on the right (on phones: under the name). */
  trail?: ReactNode;
  /** A paused student: muted, still selectable. */
  muted?: boolean;
};

export type WhoSearchLabels = {
  placeholder: string;
  /** The list's heading, «Недавні» / «Учні» / «Знайдено». */
  heading: string;
  /** Clears the typed query. */
  clear: string;
  /** Closes the search. */
  close: string;
  /** "Esc", shown as a key. */
  escape: string;
  /** Nothing found: the title and the text. */
  emptyTitle?: string;
  emptyText?: string;
};

/**
 * The student or group search in place of the card: a 56px field with focus
 * in it, «Esc» as a key hint and a clear button once something is typed; the
 * results open under it as a popover (not clipped by the dialog), headed by
 * the caller's section title. Each row shows its media, name, subline and a
 * badge; a paused student is muted but selectable. The footer is the
 * caller's create command («+ Новий учень»). The caller filters the items
 * (server search); Enter picks the highlighted row.
 */
export function WhoSearch({
  query,
  onQueryChange,
  items,
  onSelect,
  onClose,
  labels,
  footer,
  loading = false,
  compact = false,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  items: WhoSearchItem[];
  onSelect: (value: string) => void;
  onClose: () => void;
  labels: WhoSearchLabels;
  footer?: ReactNode;
  loading?: boolean;
  /** Phones: the badge moves under the name. */
  compact?: boolean;
}) {
  const [active, setActive] = useState('');
  return (
    <Command
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      loop
      className="overflow-visible rounded-none bg-transparent p-0"
    >
      <Popover open onOpenChange={(open) => (open ? undefined : onClose())} modal={false}>
        <PopoverAnchor asChild>
          <InputGroup size="field" className="h-14 rounded-row border-ring ring-3 ring-ring/16">
            <InputGroupAddon align="inline-start" className="pl-4 [&>svg]:size-4.5">
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <CommandPrimitive.Input asChild value={query} onValueChange={onQueryChange}>
              <InputGroupInput
                // Opening the search is a request to type.
                autoFocus
                aria-label={labels.placeholder}
                aria-labelledby={undefined}
                placeholder={labels.placeholder}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose();
                  }
                }}
                className="h-full pr-1 pl-2.5 text-[15px] md:text-[15px]"
              />
            </CommandPrimitive.Input>
            <InputGroupAddon align="inline-end" className="pr-3">
              {query ? (
                <IconButton
                  icon={<XIcon />}
                  label={labels.clear}
                  size={32}
                  tone="paper"
                  onClick={() => onQueryChange('')}
                />
              ) : (
                <Kbd aria-hidden="true">{labels.escape}</Kbd>
              )}
            </InputGroupAddon>
          </InputGroup>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          aria-label={labels.heading}
          className="w-(--radix-popover-trigger-width) gap-0 rounded-row p-1.5 shadow-menu"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // A press on the search field itself keeps the list open.
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-slot=input-group]')) event.preventDefault();
          }}
        >
          {/* The wrapper scrolls and takes focus: cmdk pins its list at tabindex -1. */}
          <div tabIndex={0} className="no-scrollbar max-h-80 overflow-y-auto outline-none">
            <CommandList label={labels.heading} className="max-h-none overflow-visible">
              {items.length === 0 && !loading && labels.emptyTitle ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
                  <span
                    aria-hidden="true"
                    className="mb-1 flex size-10 items-center justify-center rounded-pill bg-background text-muted-foreground [&_svg]:size-5"
                  >
                    <SearchXIcon />
                  </span>
                  <span className="text-sm font-semibold">{labels.emptyTitle}</span>
                  {labels.emptyText ? (
                    <span className="text-[13px] text-muted-foreground">{labels.emptyText}</span>
                  ) : null}
                </div>
              ) : (
                <CommandGroup
                  heading={labels.heading}
                  className="p-0 **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-[0.04em] **:[[cmdk-group-heading]]:uppercase"
                >
                  {items.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={() => onSelect(item.value)}
                      className={cn(
                        'min-h-14 gap-3 px-2.5 py-2 font-normal',
                        item.muted && 'opacity-60',
                      )}
                    >
                      {item.media}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] leading-5">{item.title}</span>
                        {item.subtitle ? (
                          <span className="truncate text-xs leading-4 text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                        {compact && item.trail ? <span className="flex">{item.trail}</span> : null}
                      </span>
                      {!compact && item.trail ? (
                        <span className="shrink-0">{item.trail}</span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </div>
          {footer ? <div className="mt-1 border-t border-border px-1 pt-1">{footer}</div> : null}
        </PopoverContent>
      </Popover>
    </Command>
  );
}

// ---------------------------------------------------------------------------
// The picked student or group
// ---------------------------------------------------------------------------

/**
 * The picked student or group as a white card: media, the name, a meta line
 * and a row of chips, with «Змінити» (or a lock in edit) on the right. On a
 * lesson window it is a link to the profile with a chevron instead. On
 * phones the chips wrap onto a full-width row under the name.
 */
export function WhoCard({
  media,
  name,
  meta,
  chips,
  action,
  locked = false,
  lockLabel,
  href,
  hrefLabel,
  trail,
  className,
}: {
  media: ReactNode;
  name: ReactNode;
  meta?: ReactNode;
  chips?: ReactNode;
  /** «Змінити». */
  action?: ReactNode;
  /** The student or group of this lesson cannot change. */
  locked?: boolean;
  lockLabel?: string;
  /** Makes the whole card a link, e.g. to the student profile. */
  href?: string;
  hrefLabel?: string;
  /** A decoration at the end of a linked card, e.g. a chevron. */
  trail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="who-card"
      className={cn(
        'relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5 rounded-row bg-card p-4 text-foreground',
        chips
          ? '[grid-template-areas:"media_text_end""chips_chips_chips"] md:[grid-template-areas:"media_text_end""media_chips_end"]'
          : '[grid-template-areas:"media_text_end"]',
        href && 'transition-shadow hover:shadow-raise',
        className,
      )}
    >
      <span className="flex [grid-area:media]">{media}</span>
      <span className="flex min-w-0 flex-col gap-px [grid-area:text]">
        <span className="truncate text-[17px] leading-[22px] font-semibold">
          {href ? (
            <Link
              prefetch={false}
              href={href}
              aria-label={hrefLabel}
              className="outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-ring"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </span>
        {meta ? (
          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      {chips ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 [grid-area:chips]">
          {chips}
        </span>
      ) : null}
      <span className="flex items-center [grid-area:end]">
        {locked ? (
          <LockIcon
            role="img"
            aria-label={lockLabel}
            aria-hidden={lockLabel ? undefined : true}
            className="size-4.5 text-muted-foreground"
          />
        ) : href ? (
          <span aria-hidden="true" className="flex text-muted-foreground [&_svg]:size-4.5">
            {trail}
          </span>
        ) : (
          action
        )}
      </span>
    </div>
  );
}

/** A chip on the picked card: a paper pill with an optional brand icon. */
export function WhoChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-6.5 items-center gap-1.5 rounded-pill bg-background px-2.5 text-xs font-semibold whitespace-nowrap text-foreground">
      {icon ? (
        <span aria-hidden="true" className="flex text-brand [&_svg]:size-3.25">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** Up to `max` overlapping avatars: a group's members. */
export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
  ringClassName = 'ring-card',
}: {
  people: { id: string; fullName: string; avatarKey: string | null }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  ringClassName?: string;
}) {
  return (
    <span aria-hidden="true" className="flex shrink-0 *:not-first:-ml-2.5">
      {people.slice(0, max).map((person) => (
        <EntityAvatar
          key={person.id}
          avatarKey={person.avatarKey}
          fullName={person.fullName}
          size={size}
          className={cn('ring-2', ringClassName)}
        />
      ))}
    </span>
  );
}
