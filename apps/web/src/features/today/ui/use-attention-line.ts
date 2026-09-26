'use client';

import { useLocale, useNow, useTranslations } from 'next-intl';
import type { AttentionCategory, AttentionItem } from '@tutorio/validation';
import { zonedDate } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { formatMoneyCompact } from '@/lib/money';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The line under a row's name in «Потребує уваги» (the brief's table): when
 * the lesson was and what happened, the debt, what a package still owes or
 * how long it lasts, when a pause ends.
 */
export function useAttentionLine() {
  const t = useTranslations('today.attention.line');
  const format = useLocalFormatter();
  const locale = useLocale();
  const timeZone = useStudioTimeZone();
  const now = useNow();
  const money = (amountMinor: number, currency: string) =>
    formatMoneyCompact(amountMinor, currency, locale).text;
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { weekday: 'short', day: 'numeric', month: 'long' });
  const isToday = (iso: string) => zonedDate(new Date(iso), timeZone) === zonedDate(now, timeZone);

  return (kind: AttentionCategory['kind'], item: AttentionItem): string => {
    switch (kind) {
      case 'attendance': {
        const lesson = item.lesson!;
        const time = format.time(Date.parse(lesson.startsAtUtc));
        return isToday(lesson.startsAtUtc)
          ? t('todayAt', { time })
          : t('dayAt', { day: day(lesson.startsAtUtc), time });
      }
      case 'makeups': {
        const lesson = item.lesson!;
        const why =
          lesson.status === 'NO_SHOW'
            ? 'noShow'
            : lesson.cancelledBy === 'STUDENT'
              ? 'student'
              : lesson.cancelledBy === 'GROUP'
                ? 'group'
                : 'teacher';
        return t('makeup', { day: day(lesson.startsAtUtc), why });
      }
      case 'debtors': {
        const debt = item.debt!;
        return t('debt', { amount: money(debt.amountMinor, debt.currency), count: debt.lessons });
      }
      case 'unpaidPackages': {
        const pkg = item.package!;
        const paid = {
          paid: money(Math.max(pkg.paidMinor, 0), pkg.currency),
          total: money(pkg.totalMinor, pkg.currency),
        };
        return pkg.name ? t('unpaidNamed', { ...paid, name: pkg.name }) : t('unpaid', paid);
      }
      case 'endingPackages': {
        const credits = item.credits!;
        const who = item.group?.name ?? item.teacher?.name ?? '';
        return credits.warning === 'NO_CREDITS'
          ? t('noCredits', { who })
          : t('creditsLeft', { who, count: credits.left });
      }
      case 'expiringPackages': {
        const pkg = item.package!;
        // The window ends at a midnight: «діє до» names the last day in it.
        const last = new Date(Date.parse(pkg.expiresAt!) - 60_000).toISOString();
        return t('expires', { day: day(last), count: pkg.remainingCredits });
      }
      case 'pauses': {
        const pause = item.pause!;
        if (pause.reason === 'RETURNING' && pause.endsAt) {
          return t('returns', { day: day(pause.endsAt) });
        }
        return t('openPause', {
          days: Math.floor((now.getTime() - Date.parse(pause.startsAt)) / DAY_MS),
        });
      }
    }
  };
}
