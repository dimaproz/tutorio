'use client';

import { useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/app/entity-avatar';
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
import { useStudentsQuery } from '@/lib/api/students';
import { cn } from '@/lib/utils';

// Searchable student picker with avatars, used to filter the parents list by
// linked student. Loads one long page of students lazily (on open or when a
// value is already set), matching the app's other MVP-size pickers.
export function StudentFilterCombobox({
  value,
  onChange,
}: {
  value?: string;
  onChange: (studentId?: string) => void;
}) {
  const t = useTranslations('parents.filters');
  const [open, setOpen] = useState(false);
  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open || Boolean(value));
  const items = students.data?.items ?? [];
  const selected = items.find((student) => student.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('byStudent')}
          className="h-11 w-full justify-between font-normal sm:w-[220px] md:h-8"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected ? (
              <EntityAvatar avatarKey={selected.avatarKey} fullName={selected.fullName} size="xs" />
            ) : null}
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected?.fullName ?? t('byStudent')}
            </span>
          </span>
          <ChevronsUpDownIcon data-icon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('studentSearch')} />
          <CommandList>
            <CommandEmpty>{t('studentEmpty')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <CheckIcon className={cn('mr-2 size-4', !value ? 'opacity-100' : 'opacity-0')} />
                {t('allStudents')}
              </CommandItem>
              {items.map((student) => (
                <CommandItem
                  key={student.id}
                  value={student.fullName}
                  onSelect={() => {
                    onChange(student.id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn('mr-2 size-4', value === student.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <EntityAvatar
                    avatarKey={student.avatarKey}
                    fullName={student.fullName}
                    size="xs"
                    className="mr-2"
                  />
                  <span className="truncate">{student.fullName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
