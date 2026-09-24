'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { PriceMode } from '../../model/create';
import { useMoney } from '../lesson-format';

/**
 * The lesson form's footer (S02 decision 8): the result before saving —
 * «3 заняття · з пакета», «1 з пакета + 2 у борг», «1 заняття · 400 ₴ з
 * учасника», «Розклад · перші 8 занять», «До розкладу · +4 заняття» — and
 * the primary action that says the same.
 */
export function useCreateFooter({
  who,
  picked,
  frequency,
  hasDate,
  count,
  allPast,
  priceMode,
  coverage,
  groupRate,
  typed,
  charged,
  currency,
  existing,
  addedSlots,
  previewCreated,
  newCount,
}: {
  who: 'student' | 'group';
  picked: boolean;
  frequency: 'once' | 'weekly';
  hasDate: boolean;
  count: number;
  allPast: boolean;
  priceMode: PriceMode;
  coverage: { covered: number; debt: number } | null;
  groupRate: number | null;
  typed: number | null;
  charged: number;
  currency: string;
  existing: boolean;
  addedSlots: number;
  previewCreated: number | null;
  newCount: number;
}): { note: ReactNode; primary: string } {
  const t = useTranslations('lessons.create');
  const money = useMoney();
  const strong = (text: string) => (
    <strong className="font-semibold text-foreground">{text}</strong>
  );
  const pick = who === 'group' ? t('footerPickGroup') : t('footerPick');

  if (frequency === 'weekly') {
    const primary = existing ? t('addToSchedule') : t('createSchedule');
    if (!picked || addedSlots === 0) return { note: pick, primary };
    return {
      primary,
      note: existing ? (
        <>
          {t('footerAdd')} · {strong(t('footerAddCount', { count: previewCreated ?? 0 }))}
        </>
      ) : (
        <>
          {t('footerSchedule')} {strong(t('footerLessons', { count: newCount }))}
        </>
      ),
    };
  }

  const primary = allPast ? t('record', { count }) : t('create', { count });
  if (!picked || !hasDate) return { note: pick, primary };
  const lessons = t('footerLessons', { count });
  if (priceMode === 'package' && coverage) {
    return {
      primary,
      note:
        coverage.debt === 0 ? (
          <>
            {lessons} · {strong(t('footerFromPackage'))}
          </>
        ) : (
          strong(t('footerMixed', { covered: coverage.covered, rest: coverage.debt }))
        ),
    };
  }
  if (priceMode === 'group' && groupRate !== null) {
    return {
      primary,
      note: (
        <>
          {lessons} · {strong(t('footerPerMember', { price: money(groupRate, currency) }))}
        </>
      ),
    };
  }
  if (typed !== null) {
    return {
      primary,
      note: (
        <>
          {lessons} · {strong(money(typed * charged, currency))}
        </>
      ),
    };
  }
  return { primary, note: lessons };
}
