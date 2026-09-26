'use client';

import { CalendarDaysIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { enUS, uk } from 'date-fns/locale';
import { DateField } from '@/components/shared/date-field';
import { FilterPill } from '@/components/shared/filter-pill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { dayStartIso } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { AUDIT_PERIODS, periodDays, type AuditFilters, type AuditPeriod } from '../model/audit';

/** The period as the pill and the empty state name it: «Останні 7 днів», «1 – 26 вересня». */
export function useAuditPeriodLabel() {
  const t = useTranslations('settings.audit.periods');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  return (filters: AuditFilters, now: number, { short = false } = {}) => {
    if (filters.period !== 'custom') return t(filters.period);
    const days = periodDays(filters, now, timeZone);
    const at = (day: string) => new Date(dayStartIso(day, timeZone));
    const options = { day: 'numeric', month: short ? 'short' : 'long' } as const;
    return days.from === days.to
      ? format.dateTime(at(days.from), options)
      : format.dateTimeRange(at(days.from), at(days.to), options);
  };
}

/**
 * The period pill (S10 board 04): the last 7 days by default, the last 30,
 * this month, or two dates of your own. A period is always set.
 */
export function AuditPeriodMenu({
  filters,
  now,
  short = false,
  onPeriod,
}: {
  filters: AuditFilters;
  now: number;
  short?: boolean;
  onPeriod: (period: AuditPeriod, range?: { from: string; to: string }) => void;
}) {
  const t = useTranslations('settings.audit.periods');
  const tFilters = useTranslations('settings.audit.filters');
  const locale = useLocale();
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const label = useAuditPeriodLabel();
  const days = periodDays(filters, now, timeZone);
  const fieldFormat = (date: Date) =>
    format.dateTime(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dateLocale = locale === 'uk' ? uk : enUS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterPill
          pressed
          menu
          icon={<CalendarDaysIcon />}
          label={label(filters, now, { short })}
          aria-label={tFilters('current', { label: t('heading'), value: label(filters, now) })}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-90 flex-col gap-2 rounded-tile p-3">
        <RadioGroup
          aria-label={t('heading')}
          value={filters.period}
          onValueChange={(next) =>
            next === 'custom' ? onPeriod('custom', days) : onPeriod(next as AuditPeriod)
          }
          className="gap-0"
        >
          {AUDIT_PERIODS.map((period) => (
            <div key={period} className="flex min-h-10 items-center gap-3 px-1">
              <RadioGroupItem id={`audit-period-${period}`} value={period} />
              <Label htmlFor={`audit-period-${period}`} className="grow text-[15px] font-normal">
                {t(period)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {filters.period === 'custom' ? (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <DateField
                aria-label={t('from')}
                value={days.from}
                onValueChange={(from) =>
                  onPeriod('custom', { from, to: days.to >= from ? days.to : from })
                }
                formatValue={fieldFormat}
                placeholder={t('pickDate')}
                locale={dateLocale}
              />
              <DateField
                aria-label={t('to')}
                value={days.to}
                onValueChange={(to) =>
                  onPeriod('custom', { from: days.from <= to ? days.from : to, to })
                }
                formatValue={fieldFormat}
                placeholder={t('pickDate')}
                locale={dateLocale}
              />
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
