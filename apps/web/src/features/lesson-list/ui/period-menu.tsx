'use client';

import type { ReactNode } from 'react';
import { CalendarDaysIcon, CheckIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { enUS, uk } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { DateField } from '@/components/shared/date-field';
import { FilterPill } from '@/components/shared/filter-pill';
import { zonedDate } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { capitalizeFirst, cn } from '@/lib/utils';
import {
  PERIOD_PRESETS,
  periodRange,
  type LessonListState,
  type PeriodPreset,
} from '../model/filters';

export function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <span className="px-3 pt-1 pb-1.5 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/** One line of a filter menu: 40px, a check for the chosen one. */
export function MenuOption({
  selected,
  onSelect,
  media,
  children,
  role = 'menuitemradio',
}: {
  selected: boolean;
  onSelect: () => void;
  media?: ReactNode;
  children: ReactNode;
  role?: 'menuitemradio' | 'option';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === 'menuitemradio' ? selected : undefined}
      aria-selected={role === 'option' ? selected : undefined}
      onClick={onSelect}
      className={cn(
        'flex min-h-10 w-full items-center gap-3 rounded-item px-3 text-left text-[15px] leading-5 outline-none hover:bg-surface-hover focus-visible:bg-surface-hover',
        selected && 'bg-surface-hover',
      )}
    >
      <CheckIcon
        aria-hidden="true"
        className={cn('size-4 shrink-0 text-primary', !selected && 'invisible')}
      />
      {media}
      <span className="min-w-0 grow truncate">{children}</span>
    </button>
  );
}

/** The period as the pill and the empty state name it. */
export function usePeriodLabel() {
  const t = useTranslations('lessonList.periods');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const year = (date: Date) => zonedDate(date, timeZone).slice(0, 4);
  const monthYear = (date: Date, withYear: boolean) => {
    const month = capitalizeFirst(format.dateTime(date, { month: 'long' }));
    return withYear ? `${month} ${year(date)}` : month;
  };
  const dayMonth = (date: Date) => format.dateTime(date, { day: 'numeric', month: 'long' });
  return (
    state: Pick<LessonListState, 'period' | 'from' | 'to'>,
    now: number,
    { short = false }: { short?: boolean } = {},
  ) => {
    const range = periodRange(state, now, timeZone);
    if (!range) return t('all');
    const last = new Date(range.to.getTime() - 1);
    switch (state.period) {
      case 'month':
      case 'lastMonth':
        return monthYear(range.from, !short);
      case 'last3Months':
        return t('last3Months');
      case 'week':
        return format.dateTimeRange(range.from, last, { day: 'numeric', month: 'long' });
      default: {
        const suffix = short ? '' : ` ${year(last)}`;
        return zonedDate(range.from, timeZone) === zonedDate(last, timeZone)
          ? `${dayMonth(range.from)}${suffix}`
          : `${format.dateTimeRange(range.from, last, { day: 'numeric', month: 'long' })}${suffix}`;
      }
    }
  };
}

/**
 * «Період» (S04 board 04): the quick choices — this week, this month, last
 * month, the last three months, all time — and a custom range of two dates.
 * A period is always set, so the pill always reads pressed.
 */
export function PeriodMenu({
  state,
  now,
  short = false,
  onPreset,
  onRange,
}: {
  state: LessonListState;
  now: number;
  short?: boolean;
  onPreset: (preset: PeriodPreset) => void;
  onRange: (range: { from: string; to: string }) => void;
}) {
  const t = useTranslations('lessonList.periods');
  const tFields = useTranslations('lessons.fields');
  const format = useLocalFormatter();
  const locale = useLocale();
  const label = usePeriodLabel();
  const timeZone = useStudioTimeZone();
  const range = periodRange(state, now, timeZone);
  const toKey = (date: Date) => zonedDate(date, timeZone);
  const from = range ? toKey(range.from) : '';
  const to = range ? toKey(new Date(range.to.getTime() - 1)) : '';
  const fieldFormat = (date: Date) =>
    format.dateTime(date, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterPill
          pressed
          icon={<CalendarDaysIcon />}
          label={label(state, now, { short })}
          aria-label={t('current', { value: label(state, now) })}
          menu
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={t('heading')}
        className="flex w-[400px] flex-col gap-0.5 rounded-tile p-2"
      >
        <MenuHeading>{t('quick')}</MenuHeading>
        <div role="menu" aria-label={t('quick')} className="flex flex-col gap-0.5">
          {PERIOD_PRESETS.map((preset) => (
            <MenuOption
              key={preset}
              selected={state.period === preset}
              onSelect={() => onPreset(preset)}
            >
              {t(preset)}
            </MenuOption>
          ))}
        </div>
        <Separator className="my-1.5" />
        <MenuHeading>{t('custom')}</MenuHeading>
        <div className="grid grid-cols-2 gap-2 px-1 pb-1">
          <DateField
            aria-label={t('from')}
            value={from}
            onValueChange={(next) => onRange({ from: next, to: to && to >= next ? to : next })}
            formatValue={fieldFormat}
            placeholder={tFields('pickDate')}
            locale={locale === 'uk' ? uk : enUS}
          />
          <DateField
            aria-label={t('to')}
            value={to}
            onValueChange={(next) =>
              onRange({ from: from && from <= next ? from : next, to: next })
            }
            formatValue={fieldFormat}
            placeholder={tFields('pickDate')}
            locale={locale === 'uk' ? uk : enUS}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
