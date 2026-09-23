'use client';

import { useState, type ReactNode } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
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
  description?: string;
  badges?: ReactNode[];
}

/** Searchable, avatar-aware entity picker for forms and collection filters. */
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
  invalid = false,
  isLoading = false,
  trigger,
  appearance = 'button',
  icon,
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
  'aria-describedby'?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            disabled={disabled}
            className={cn(
              appearance === 'field'
                ? cn(fieldBoxClass, 'justify-between font-normal hover:bg-card')
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
            ) : (
              <ChevronsUpDownIcon data-icon className="opacity-50" />
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        aria-label={ariaLabel ?? placeholder}
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup className="p-1">
              {clearLabel ? (
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
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5"
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <EntityAvatar avatarKey={option.avatarKey} fullName={option.label} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>
                  <CheckIcon
                    className={cn(
                      'size-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
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
