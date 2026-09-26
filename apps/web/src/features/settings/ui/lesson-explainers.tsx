'use client';

import type { ReactNode } from 'react';
import { BanknoteIcon, CalendarDaysIcon, CircleCheckIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { addCalendarDays, calendarWeekStart, dayStartIso, zonedDate } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { cn } from '@/lib/utils';

/**
 * The small pictures beside each number on «Заняття й пакети» (S10 board
 * 03): what the setting does, drawn with the value being edited. Decorative
 * figures carry their meaning in text as well.
 */

function ExplainPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-row bg-background p-4 md:px-4.5', className)}>
      {children}
    </div>
  );
}

/** The paid share of the bar grows with the window, and never swallows the free part. */
function paidShare(hours: number): number {
  return Math.round(Math.min(60, 36 + (hours / 48) * 10));
}

/** L-51: free until the window, charged inside it, then the lesson. */
export function CancellationExplainer({ hours }: { hours: number }) {
  const t = useTranslations('settings.lessons.cancellation');
  return (
    <ExplainPanel>
      <div className="flex h-11 overflow-hidden rounded-item text-[13px] leading-4 font-bold">
        <span className="flex min-w-0 grow items-center gap-2 bg-tint-success px-3.5 text-tint-success-foreground">
          <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{t('free')}</span>
        </span>
        {hours > 0 ? (
          <span
            style={{ flexBasis: `${paidShare(hours)}%` }}
            className="flex min-w-0 shrink-0 items-center gap-2 bg-tint-warning px-3 text-tint-warning-foreground"
          >
            <BanknoteIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate md:hidden">{t('paidShort')}</span>
            <span className="hidden truncate md:inline">{t('paid')}</span>
          </span>
        ) : null}
        <span className="flex w-12 shrink-0 items-center justify-center bg-primary text-primary-foreground">
          <CalendarDaysIcon aria-hidden="true" className="size-4.5" />
          <span className="sr-only">{t('lesson')}</span>
        </span>
      </div>
      <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-4 text-muted-foreground">
        {hours > 0 ? (
          <>
            <span>{t('early')}</span>
            <span>{t('before', { count: hours })}</span>
          </>
        ) : (
          <span>{t('anyTime')}</span>
        )}
      </p>
    </ExplainPanel>
  );
}

const WEEK_CELLS = 8;

/** L-120: the weeks a new schedule books from this one, and the date they reach. */
export function HorizonExplainer({ weeks }: { weeks: number }) {
  const t = useTranslations('settings.lessons.horizon');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const now = useNow();
  const monday = calendarWeekStart(zonedDate(now, timeZone));
  const cells = Array.from({ length: WEEK_CELLS }, (_, index) =>
    addCalendarDays(monday, index * 7),
  );
  const until = addCalendarDays(monday, weeks * 7 - 1);
  const at = (day: string) => new Date(dayStartIso(day, timeZone));
  const cellLabel = (day: string, index: number) =>
    index === 0 || day.slice(8) <= '07'
      ? format.dateTime(at(day), { day: 'numeric', month: 'short' })
      : String(Number(day.slice(8)));

  return (
    <ExplainPanel>
      <ol
        className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8"
        aria-hidden="true"
      >
        {cells.map((day, index) => (
          <li
            key={day}
            className={cn(
              'flex flex-col items-center gap-2',
              index >= 6 && 'max-sm:hidden lg:max-xl:hidden',
            )}
          >
            <span
              className={cn(
                'flex h-11 w-full items-center justify-center gap-1 rounded-control',
                index < weeks ? 'bg-tile-indigo' : 'border border-border',
              )}
            >
              {index < weeks ? (
                <>
                  <span className="size-1.5 rounded-pill bg-tile-indigo-foreground" />
                  <span className="size-1.5 rounded-pill bg-tile-indigo-foreground" />
                </>
              ) : null}
            </span>
            <span className="text-xs leading-4 whitespace-nowrap text-muted-foreground">
              {cellLabel(day, index)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[13px] leading-[19px] text-muted-foreground">
        {t.rich('caption', {
          date: format.dateTime(at(until), { day: 'numeric', month: 'short' }),
          b: (chunks) => <strong className="font-bold text-foreground">{chunks}</strong>,
        })}
      </p>
    </ExplainPanel>
  );
}

const PACKAGE_SIZE = 8;

/** L-82: a package of eight with this many lessons left, as a student row shows it. */
export function LowCreditExplainer({ threshold }: { threshold: number }) {
  const t = useTranslations('settings.lessons.lowCredit');
  const tUnits = useTranslations('settings.units');
  const off = threshold === 0;
  // With the warning off, the row shows a package that is simply in use.
  const left = off ? 3 : Math.min(threshold, PACKAGE_SIZE);
  const name = t('sampleName');

  return (
    <ExplainPanel>
      <div className="flex items-center gap-3 rounded-tile bg-card p-3.5">
        <EntityAvatar avatarKey="user-1" fullName={name} size="sm" />
        <div className="flex min-w-0 grow flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] leading-5 font-bold">{name}</span>
            <Badge variant={off ? 'neutral' : 'warning'}>
              {off ? tUnits('noWarnings') : t('badge')}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span
              role="img"
              aria-label={t('creditsLeft', { left, total: PACKAGE_SIZE })}
              className="flex flex-wrap gap-1.5"
            >
              {Array.from({ length: PACKAGE_SIZE }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'size-3.5 rounded-pill',
                    index < PACKAGE_SIZE - left
                      ? 'border-2 border-border'
                      : off
                        ? 'bg-brand'
                        : 'bg-warning',
                  )}
                />
              ))}
            </span>
            <span className="tabular-nums text-xs text-muted-foreground" aria-hidden="true">
              {t('left', { left, total: PACKAGE_SIZE })}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[13px] leading-[19px] text-muted-foreground">
        {off ? t('offCaption') : t('caption')}
      </p>
    </ExplainPanel>
  );
}
