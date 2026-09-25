'use client';

import { useState, type ReactNode } from 'react';
import { GraduationCapIcon, ListFilterIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeacherResponse } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FilterPill } from '@/components/shared/filter-pill';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  DEFAULT_STATUS_FILTER,
  STATUS_KEYS,
  statusFilterCount,
  type StatusFilter,
  type StatusKey,
} from '../model/filters';
import { UnpaidMark } from './calendar-event';

export type CalendarTeacher = Pick<TeacherResponse, 'id' | 'fullName' | 'avatarKey' | 'color'>;

/** One checkbox line with its count: a teacher or a status. */
function CheckRow({
  id,
  checked,
  onChange,
  media,
  label,
  count,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  media?: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <div
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-control px-2',
        checked && 'bg-secondary',
      )}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      {media}
      <Label htmlFor={id} className="grow text-[15px] leading-5 font-normal">
        {label}
      </Label>
      {count !== undefined ? (
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <span className="px-2 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function StatusLines({
  filter,
  counts,
  onChange,
  idPrefix,
}: {
  filter: StatusFilter;
  counts: Record<StatusKey, number>;
  onChange: (filter: StatusFilter) => void;
  idPrefix: string;
}) {
  const t = useTranslations('calendar.statusFilter');
  return (
    <>
      {STATUS_KEYS.map((key) => (
        <CheckRow
          key={key}
          id={`${idPrefix}-${key}`}
          checked={filter.shown[key]}
          onChange={(checked) =>
            onChange({ ...filter, shown: { ...filter.shown, [key]: checked } })
          }
          label={t(key)}
          count={counts[key]}
        />
      ))}
      <Separator className="my-1" />
      <div className="flex min-h-11 items-center gap-3 px-2">
        <UnpaidMark className="size-5 text-[11px]" />
        <Label htmlFor={`${idPrefix}-unpaid`} className="grow text-[15px] leading-5 font-normal">
          {t('unpaidOnly')}
        </Label>
        <Switch
          id={`${idPrefix}-unpaid`}
          checked={filter.unpaidOnly}
          onCheckedChange={(unpaidOnly) => onChange({ ...filter, unpaidOnly })}
        />
      </div>
    </>
  );
}

/**
 * «Статус»: a menu of checkboxes with the period's counts, «Лише не
 * оплачені», and «Скинути / Готово». The draft applies on «Готово».
 */
export function StatusFilterMenu({
  filter,
  counts,
  onChange,
  open,
  onOpenChange,
}: {
  filter: StatusFilter;
  counts: Record<StatusKey, number>;
  onChange: (filter: StatusFilter) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('calendar.statusFilter');
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [draft, setDraft] = useState(filter);
  const count = statusFilterCount(filter);
  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        if (next) setDraft(filter);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <FilterPill
          label={t('label')}
          icon={<ListFilterIcon />}
          menu
          count={count > 0 ? count : undefined}
          className={cn(count > 0 && 'border-primary')}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={t('label')}
        className="flex w-96 flex-col gap-1 rounded-tile p-3"
      >
        <SectionTitle>{t('heading')}</SectionTitle>
        <StatusLines filter={draft} counts={counts} onChange={setDraft} idPrefix="status-menu" />
        <Separator className="my-1" />
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <Button type="button" variant="ghost" onClick={() => setDraft(DEFAULT_STATUS_FILTER)}>
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

function TeacherAvatar({ teacher, size = 'size-7' }: { teacher: CalendarTeacher; size?: string }) {
  return (
    <EntityAvatar
      avatarKey={teacher.avatarKey}
      fullName={teacher.fullName}
      tint="indigo"
      className={size}
    />
  );
}

/**
 * The teacher filter (decision 7): one teacher reads as their avatar and
 * name, several as «Викладачі» with a count; no choice shows everyone.
 */
export function TeacherFilterMenu({
  teachers,
  selected,
  counts,
  onChange,
}: {
  teachers: readonly CalendarTeacher[];
  /** Picked teacher ids; empty is everyone. */
  selected: readonly string[];
  counts: Record<string, number>;
  onChange: (selected: string[]) => void;
}) {
  const t = useTranslations('calendar.teacherFilter');
  const one = selected.length === 1 ? teachers.find((teacher) => teacher.id === selected[0]) : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterPill
          label={one ? one.fullName : selected.length > 1 ? t('label') : t('all')}
          icon={one ? <TeacherAvatar teacher={one} size="size-6" /> : <GraduationCapIcon />}
          menu
          pressed={selected.length > 0}
          count={selected.length > 1 ? selected.length : undefined}
          className={cn(one && 'pl-1.5')}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={t('heading')}
        className="flex w-80 flex-col gap-1 rounded-tile p-3"
      >
        <SectionTitle>{t('heading')}</SectionTitle>
        {teachers.map((teacher) => (
          <CheckRow
            key={teacher.id}
            id={`teacher-menu-${teacher.id}`}
            checked={selected.includes(teacher.id)}
            onChange={(checked) =>
              onChange(
                checked ? [...selected, teacher.id] : selected.filter((id) => id !== teacher.id),
              )
            }
            media={<TeacherAvatar teacher={teacher} />}
            label={teacher.fullName}
            count={counts[teacher.id] ?? 0}
          />
        ))}
        <Separator className="my-1" />
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          disabled={selected.length === 0}
          onClick={() => onChange([])}
        >
          {t('all')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The phone's filters in a bottom sheet: teachers and statuses with their
 * counts, «Скинути», and «Показати N занять» that applies them.
 */
export function CalendarFilterSheet({
  open,
  onOpenChange,
  teachers,
  selected,
  teacherCounts,
  filter,
  statusCounts,
  countFor,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: readonly CalendarTeacher[];
  selected: readonly string[];
  teacherCounts: Record<string, number>;
  filter: StatusFilter;
  statusCounts: Record<StatusKey, number>;
  /** How many lessons a draft would show. */
  countFor: (selected: readonly string[], filter: StatusFilter) => number;
  onApply: (selected: string[], filter: StatusFilter) => void;
}) {
  const t = useTranslations('calendar.filters');
  const [draftTeachers, setDraftTeachers] = useState<string[]>([...selected]);
  const [draftFilter, setDraftFilter] = useState(filter);
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraftTeachers([...selected]);
          setDraftFilter(filter);
        }
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <DrawerHeader className="flex-row items-center justify-between px-5 pt-5 pb-0">
          <DrawerTitle className="text-xl leading-7 font-semibold">{t('title')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('description')}</DrawerDescription>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraftTeachers([]);
              setDraftFilter(DEFAULT_STATUS_FILTER);
            }}
          >
            {t('reset')}
          </Button>
        </DrawerHeader>
        <div className="scrollbar-thin flex min-h-0 flex-col gap-1 overflow-y-auto px-3 pt-3">
          {teachers.length > 1 ? (
            <>
              <SectionTitle>{t('teachers')}</SectionTitle>
              {teachers.map((teacher) => (
                <CheckRow
                  key={teacher.id}
                  id={`teacher-sheet-${teacher.id}`}
                  checked={draftTeachers.includes(teacher.id)}
                  onChange={(checked) =>
                    setDraftTeachers((current) =>
                      checked
                        ? [...current, teacher.id]
                        : current.filter((id) => id !== teacher.id),
                    )
                  }
                  media={<TeacherAvatar teacher={teacher} size="size-9" />}
                  label={teacher.fullName}
                  count={teacherCounts[teacher.id] ?? 0}
                />
              ))}
              <div className="h-3" />
            </>
          ) : null}
          <SectionTitle>{t('status')}</SectionTitle>
          <StatusLines
            filter={draftFilter}
            counts={statusCounts}
            onChange={setDraftFilter}
            idPrefix="status-sheet"
          />
        </div>
        <DrawerFooter className="px-5 pt-4">
          <Button
            type="button"
            size="xl"
            onClick={() => {
              onApply(draftTeachers, draftFilter);
              onOpenChange(false);
            }}
          >
            {t('show', { count: countFor(draftTeachers, draftFilter) })}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
