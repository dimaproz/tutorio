'use client';

import { useState, type ReactNode } from 'react';
import { CheckIcon, ChevronsUpDownIcon, LockIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { PersonMiniCard } from '@/components/shared/person-mini-card';
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
import { Spinner } from '@/components/ui/spinner';
import { fieldBoxClass } from '@/components/shared/text-field';
import { cn } from '@/lib/utils';

export interface EntityPickerOption {
  value: string;
  label: string;
  avatarKey?: string | null;
  /** A second line under the name, e.g. a teacher's subjects. */
  description?: string;
  /** Chips beside the name, e.g. "основний". */
  badges?: ReactNode[];
  /** A note at the row's end, e.g. "• Зайнятий о 17:00". */
  trail?: ReactNode;
  /** Replaces the avatar, e.g. a group's tile. */
  media?: ReactNode;
  /** The heading this option is listed under («Учні», «Групи»), in option order. */
  section?: string;
  /** Listed but not selectable, e.g. a direction in another currency (its `trail` says why). */
  disabled?: boolean;
}

/** Options by their section, keeping the order they came in. */
function sectionsOf(options: EntityPickerOption[]) {
  const sections: { heading?: string; options: EntityPickerOption[] }[] = [];
  for (const option of options) {
    const last = sections.at(-1);
    if (last && last.heading === option.section) last.options.push(option);
    else sections.push({ heading: option.section, options: [option] });
  }
  return sections;
}

/**
 * Searchable, avatar-aware entity picker for forms and collection filters.
 * An option with a `description`, `badges` or a `trail` renders as a rich
 * row (the lesson form's teacher list); `locked` shows the choice with a
 * lock instead of the chevrons, for a value that cannot change here. Options
 * with a `section` are listed under their headings; `onSearchChange` hands
 * the search to the caller (a server-side search) instead of filtering here;
 * `footer` adds a note under the list; a `disabled` option is listed but
 * cannot be picked.
 */
export function EntityPicker({
  id,
  'aria-label': ariaLabel,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  disabled = false,
  locked = false,
  invalid = false,
  isLoading = false,
  trigger,
  appearance = 'button',
  icon,
  onSearchChange,
  footer,
  contentClassName,
  'aria-describedby': describedBy,
}: {
  id?: string;
  'aria-label'?: string;
  value?: string;
  options: EntityPickerOption[];
  onChange: (value?: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  clearLabel?: string;
  disabled?: boolean;
  /** The disabled look with a lock at the end: the value cannot change here. */
  locked?: boolean;
  invalid?: boolean;
  isLoading?: boolean;
  /**
   * A custom opener, e.g. a compact "Link existing" button, for places where
   * the picker is a command rather than a form field.
   */
  trigger?: ReactNode;
  /** `field` draws the 52px form field box of `TextField` around the choice. */
  appearance?: 'button' | 'field';
  /** Leading glyph inside a `field` box, e.g. a mortarboard for a teacher. */
  icon?: ReactNode;
  /** Takes over the search: the caller filters (or asks the server) and passes the options. */
  onSearchChange?: (search: string) => void;
  /** A note under the list, e.g. what the filter includes. */
  footer?: ReactNode;
  /** Widens the list, e.g. under a narrow filter pill. */
  contentClassName?: string;
  'aria-describedby'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((option) => option.value === value);
  const rich = options.some((option) => option.description || option.badges || option.trail);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && onSearchChange) {
          setSearch('');
          onSearchChange('');
        }
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            id={id}
            aria-label={ariaLabel}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled || locked}
            className={cn(
              appearance === 'field'
                ? cn(
                    fieldBoxClass,
                    'justify-between font-normal hover:bg-card',
                    locked && 'disabled:opacity-100 disabled:[&>span]:text-muted-foreground',
                  )
                : 'w-full justify-between font-normal',
            )}
          >
            <span
              className={cn(
                'flex min-w-0 items-center truncate',
                appearance === 'field' ? 'gap-2.5' : 'gap-2',
              )}
            >
              {icon && !selected ? (
                <span aria-hidden="true" className="flex text-muted-foreground [&_svg]:size-4.5">
                  {icon}
                </span>
              ) : null}
              {selected ? (
                <EntityAvatar avatarKey={selected.avatarKey} fullName={selected.label} size="xs" />
              ) : null}
              <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                {selected?.label ?? placeholder}
              </span>
            </span>
            {isLoading ? (
              <Spinner data-icon />
            ) : locked ? (
              <LockIcon data-icon className="size-3.75 text-muted-foreground" />
            ) : (
              <ChevronsUpDownIcon data-icon className="opacity-50" />
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          'w-(--radix-popover-trigger-width) min-w-72 p-0',
          rich && 'rounded-row shadow-menu',
          contentClassName,
        )}
        align="start"
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            {...(onSearchChange
              ? {
                  value: search,
                  onValueChange: (next: string) => {
                    setSearch(next);
                    onSearchChange(next);
                  },
                }
              : {})}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {clearLabel ? (
              <CommandGroup className="p-1">
                <CommandItem
                  value="__clear__"
                  className="rounded-md px-2 py-1.5"
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  {clearLabel}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {sectionsOf(options).map((section, index) => (
              <CommandGroup
                key={section.heading ?? index}
                heading={section.heading}
                className="p-1"
              >
                {section.options.map((option) =>
                  rich ? (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      disabled={option.disabled}
                      data-checked={value === option.value}
                      className="min-h-14 gap-3 rounded-control px-2.5 py-2 font-normal data-[checked=true]:font-normal"
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.media ?? (
                        <EntityAvatar
                          avatarKey={option.avatarKey}
                          fullName={option.label}
                          size="sm"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[15px] leading-5">{option.label}</span>
                          {option.badges}
                        </span>
                        {option.description ? (
                          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {option.trail ? <span className="shrink-0">{option.trail}</span> : null}
                    </CommandItem>
                  ) : (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      disabled={option.disabled}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5"
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.media ?? (
                        <EntityAvatar
                          avatarKey={option.avatarKey}
                          fullName={option.label}
                          size="xs"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>
                      <CheckIcon
                        className={cn(
                          'size-4 shrink-0',
                          value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ),
                )}
              </CommandGroup>
            ))}
          </CommandList>
          {footer ? (
            <p className="border-t border-border px-3 py-2.5 text-[13px] leading-[18px] text-muted-foreground">
              {footer}
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Multiple entity links with searchable selection and removable avatar chips. */
export function EntityMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  removeLabel,
  pickerAriaLabel,
  disabled = false,
  isLoading = false,
}: {
  options: EntityPickerOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  removeLabel: (name: string) => string;
  pickerAriaLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const selected = options.filter((option) => selectedIds.includes(option.value));
  const available = options.filter((option) => !selectedIds.includes(option.value));

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 ? (
        <div className="grid gap-2">
          {selected.map((option) => (
            <PersonMiniCard
              key={option.value}
              avatarKey={option.avatarKey}
              fullName={option.label}
              subtitle={option.description}
              badge={
                option.badges && option.badges.length > 0 ? (
                  <span className="flex shrink-0 gap-1">{option.badges}</span>
                ) : undefined
              }
              onRemove={() => onChange(selectedIds.filter((id) => id !== option.value))}
              removeLabel={removeLabel(option.label)}
            />
          ))}
        </div>
      ) : null}
      <EntityPicker
        aria-label={pickerAriaLabel}
        options={available}
        onChange={(id) => id && onChange([...selectedIds, id])}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        disabled={disabled}
        isLoading={isLoading}
      />
    </div>
  );
}
