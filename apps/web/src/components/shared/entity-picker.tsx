'use client';

import { useState, type ReactNode } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { PersonMiniCard } from '@/components/app/person-mini-card';
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
}: {
  id?: string;
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
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
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
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
