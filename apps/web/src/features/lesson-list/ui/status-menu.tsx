'use client';

import { useState } from 'react';
import { ArrowUpDownIcon, ListFilterIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { FilterPill } from '@/components/shared/filter-pill';
import { cn } from '@/lib/utils';
import { STATUS_OPTIONS, type ListOrder, type StatusOption } from '../model/filters';

/** The status lines with their checkboxes, for the menu and the phone sheet. */
export function StatusChecks({
  value,
  onChange,
  idPrefix,
}: {
  value: readonly StatusOption[];
  onChange: (value: StatusOption[]) => void;
  idPrefix: string;
}) {
  const t = useTranslations('lessonList.statuses');
  return (
    <div className="flex flex-col gap-0.5">
      {STATUS_OPTIONS.map((option) => {
        const checked = value.includes(option);
        const id = `${idPrefix}-${option}`;
        return (
          <div
            key={option}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-item px-2',
              checked && 'bg-secondary',
            )}
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? STATUS_OPTIONS.filter((item) => item === option || value.includes(item))
                    : value.filter((item) => item !== option),
                )
              }
            />
            <Label htmlFor={id} className="grow text-[15px] leading-5 font-normal">
              {t(option)}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

/**
 * «Статус» (S04 board 07): the statuses to show, several at once; the draft
 * applies on «Готово», «Скинути» clears it.
 */
export function StatusMenu({
  value,
  onChange,
}: {
  value: readonly StatusOption[];
  onChange: (value: StatusOption[]) => void;
}) {
  const t = useTranslations('lessonList.filters');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StatusOption[]>([...value]);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft([...value]);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <FilterPill
          menu
          pressed={value.length > 0}
          icon={<ListFilterIcon />}
          label={t('status')}
          count={value.length > 0 ? value.length : undefined}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={t('status')}
        className="flex w-80 flex-col gap-1 rounded-tile p-2"
      >
        <StatusChecks value={draft} onChange={setDraft} idPrefix="status-menu" />
        <Separator className="my-1" />
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <Button type="button" variant="ghost" onClick={() => setDraft([])}>
            {t('reset')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            {t('done')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** «Спочатку нові / старі». */
export function SortMenu({
  order,
  onChange,
  short = false,
}: {
  order: ListOrder;
  onChange: (order: ListOrder) => void;
  short?: boolean;
}) {
  const t = useTranslations('lessonList.sort');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterPill
          menu
          icon={<ArrowUpDownIcon />}
          label={short ? t(`${order}Short`) : t(order)}
          aria-label={t('current', { value: t(order) })}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={order} onValueChange={(next) => onChange(next as ListOrder)}>
          <DropdownMenuRadioItem value="desc">{t('desc')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="asc">{t('asc')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
