'use client';

import { useId, useState } from 'react';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { StudioSubject } from '../model/presentation';

/** The command value of «add what was typed». */
const CREATE = '__create';

/**
 * «Предмети» (S09 board 03-02): the picked subjects as removable chips and
 * «+ Додати предмет», which opens a popover — search «Знайти або ввести
 * новий», «Предмети студії» with a checkbox and who teaches each, and a new
 * subject by typing its name and Enter. Controlled: the form owns the list.
 */
export function SubjectsField({
  value,
  studio,
  onAdd,
  onRemove,
  max,
  error,
  disabled = false,
}: {
  value: string[];
  /** The studio's subjects for the popover, the picked ones first. */
  studio: StudioSubject[];
  onAdd: (subject: string) => void;
  onRemove: (subject: string) => void;
  max: number;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations('teachers.form');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const typed = search.trim();
  const exists = studio.some(
    (item) => item.subject.toLocaleLowerCase() === typed.toLocaleLowerCase(),
  );
  const full = value.length >= max;

  const who = (item: StudioSubject) =>
    item.isNew
      ? t('newInStudio')
      : item.teachers.length === 1
        ? (item.teachers[0]!.fullName.split(/\s+/)[0] ?? '')
        : item.teachers.length > 1
          ? t('taughtByMany', { count: item.teachers.length })
          : '';

  const toggle = (item: StudioSubject) =>
    item.selected ? onRemove(item.subject) : !full && onAdd(item.subject);

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <FieldLabel id={`${id}-label`}>{t('subjects')}</FieldLabel>
      <ul className="flex flex-wrap items-center gap-2">
        {value.map((subject) => (
          <li key={subject}>
            <Badge variant="indigo" size="lg" className="h-8 gap-1 pr-1.5 pl-3 text-sm">
              {subject}
              <button
                type="button"
                disabled={disabled}
                aria-label={t('removeSubject', { name: subject })}
                onClick={() => onRemove(subject)}
                className="flex size-5 items-center justify-center rounded-pill outline-none hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </button>
            </Badge>
          </li>
        ))}
        <li>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-8 rounded-pill"
              >
                <PlusIcon data-icon="inline-start" />
                {t('addSubject')}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              aria-label={t('subjects')}
              className="w-90 max-w-[calc(100vw-32px)] p-0"
            >
              <Command label={t('subjectSearch')}>
                <CommandInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder={t('subjectSearch')}
                  aria-label={t('subjectSearch')}
                />
                <CommandList className="scrollbar-thin max-h-80">
                  {studio.length === 0 && !typed ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      {t('noSubjects')}
                    </p>
                  ) : null}
                  {studio.length > 0 ? (
                    <CommandGroup heading={t('studioSubjects')}>
                      {studio.map((item) => (
                        <CommandItem
                          key={item.subject}
                          value={item.subject}
                          disabled={!item.selected && full}
                          onSelect={() => toggle(item)}
                        >
                          {/* A mark, not a control: the option itself toggles. */}
                          <span
                            aria-hidden="true"
                            data-checked={item.selected || undefined}
                            className="flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-input data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground"
                          >
                            {item.selected ? <CheckIcon className="size-3.5" /> : null}
                          </span>
                          <span className="grow truncate">
                            {item.subject}
                            {item.selected ? (
                              <span className="sr-only">{`, ${t('subjectPicked')}`}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {who(item)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {/* After the matches: Enter picks a match first, and a name
                      nobody has is the only row left to pick. */}
                  {typed && !exists ? (
                    <CommandGroup>
                      <CommandItem
                        forceMount
                        value={CREATE}
                        disabled={full}
                        onSelect={() => {
                          onAdd(typed);
                          setSearch('');
                        }}
                      >
                        <PlusIcon />
                        {t('createSubject', { name: typed })}
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </CommandList>
                <CommandSeparator />
                <p className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-muted-foreground">
                  <PlusIcon aria-hidden="true" className="size-3.5" />
                  {full ? t('subjectsMax', { max }) : t('createHint')}
                </p>
              </Command>
            </PopoverContent>
          </Popover>
        </li>
      </ul>
      {error ? (
        <FieldError className="text-[13px]">{error}</FieldError>
      ) : (
        <FieldDescription className="text-[13px]">{t('subjectsHint')}</FieldDescription>
      )}
    </div>
  );
}
