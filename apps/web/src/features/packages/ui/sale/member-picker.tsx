'use client';

import { BanknoteIcon, CheckIcon, InfoIcon, PauseIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Notice } from '@/components/shared/notice';
import { cn } from '@/lib/utils';
import { lastDayOf } from '../../model/dates';
import type { MemberBillingState } from '../../model/member-billing';
import type { MemberSaleCandidate, MemberSalePreviewItem } from '../../model/member-sale';
import { usePackageFormat } from '../use-package-format';

/** What the picker knows about one member beyond who they are. */
export type MemberPickerRow = {
  candidate: MemberSaleCandidate;
  picked: boolean;
  /** Their own rate is applied (decision 8). */
  applied: boolean;
  /** What a ticked member is sold. */
  line: { lessons: number; totalMinor: number } | null;
  preview: MemberSalePreviewItem | undefined;
  /** «9 × 350 = 3 150 ₴», while their own rate is not applied. */
  ownHint: { rateMinor: number; lessons: number; totalMinor: number } | null;
};

const STATE_TONE: Record<MemberBillingState['kind'], string> = {
  debt: 'text-tint-danger-foreground',
  low: 'text-tint-warning-foreground',
  partial: 'text-muted-foreground',
  unpaid: 'text-muted-foreground',
  noPackage: 'text-muted-foreground',
  paid: 'text-muted-foreground',
  paused: 'text-muted-foreground',
};

/** A member's standing as the picker says it: «пакет 2 з 8 закінчується», «борг 800 ₴ · 2 заняття». */
function useStateText() {
  const t = useTranslations('packages.memberSale.state');
  const format = usePackageFormat();
  return (state: MemberBillingState): string => {
    const pkg = state.pkg;
    switch (state.kind) {
      case 'debt':
        return state.debt?.source === 'credits'
          ? t('debtCredits', { count: state.debt.lessons })
          : t('debtBalance', {
              amount: format.money(state.debt?.minor ?? 0, state.currency),
              count: state.debt?.lessons ?? 0,
            });
      case 'low':
        return t('low', { left: pkg?.left ?? 0, total: pkg?.total ?? 0 });
      case 'partial':
        return t('partial', {
          left: pkg?.left ?? 0,
          total: pkg?.total ?? 0,
          amount: format.money(pkg?.paidMinor ?? 0, state.currency),
        });
      case 'unpaid':
        return t('unpaid', { left: pkg?.left ?? 0, total: pkg?.total ?? 0 });
      case 'noPackage':
        return t('noPackage');
      case 'paid':
        return pkg?.expiresAt
          ? t('paid', {
              left: pkg.left,
              total: pkg.total,
              date: format.shortDay(lastDayOf(pkg.expiresAt)),
            })
          : t('paidNoEnd', { left: pkg?.left ?? 0, total: pkg?.total ?? 0 });
      case 'paused':
        return state.pausedUntil
          ? t('paused', { date: format.shortDay(lastDayOf(state.pausedUntil)) })
          : t('pausedOpen');
    }
  };
}

/**
 * «Кому · N з M» (S08 board 02): every member with a checkbox, their
 * standing in its colour and — ticked — what they are sold; the lessons on
 * debt the package closes first (L-82), their own rate as a hint applied only
 * on a click (decision 8) and reset with «Як у групи», a pause that holds
 * the first lessons back (L-73); then «Разом».
 */
export function MemberPicker({
  rows,
  currency,
  onToggle,
  onToggleAll,
  onApply,
  onReset,
  total,
}: {
  rows: MemberPickerRow[];
  currency: string;
  onToggle: (studentId: string, picked: boolean) => void;
  onToggleAll: (picked: boolean) => void;
  onApply: (studentId: string) => void;
  onReset: (studentId: string) => void;
  /** «3 пакети · по 9 занять · 1–31 жовт» and the sum; null while nobody is ticked. */
  total: { line: string; amount: string } | null;
}) {
  const t = useTranslations('packages.memberSale');
  const format = usePackageFormat();
  const stateText = useStateText();
  const picked = rows.filter((row) => row.picked).length;
  const everyone = picked === rows.length;

  return (
    <section aria-label={t('who', { picked, total: rows.length })} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] leading-5 font-semibold">
          {t('who', { picked, total: rows.length })}
        </h3>
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0 font-semibold"
          onClick={() => onToggleAll(!everyone)}
        >
          {everyone ? t('clearAll') : t('selectAll')}
        </Button>
      </div>
      <p className="text-[13px] leading-[18px] text-muted-foreground">{t('whoHint')}</p>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const { candidate } = row;
          const pause =
            row.preview?.pause ??
            (candidate.state.kind === 'paused' ? { endsAt: candidate.state.pausedUntil } : null);
          const debtLessons = row.preview?.debtLessons ?? 0;
          return (
            <li
              key={candidate.studentId}
              className={cn(
                'flex flex-col gap-2.5 rounded-[18px] border bg-card p-3.5 transition-shadow',
                row.picked ? 'border-transparent ring-2 ring-primary/35' : 'border-border',
              )}
            >
              <label className="grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3">
                <Checkbox
                  className="size-5.5 rounded-[7px] border-border bg-card"
                  checked={row.picked}
                  onCheckedChange={(checked) => onToggle(candidate.studentId, checked === true)}
                  aria-label={t('pick', { name: candidate.fullName })}
                />
                <EntityAvatar
                  avatarKey={candidate.avatarKey}
                  fullName={candidate.fullName}
                  size="md"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] leading-5 font-semibold">
                    {candidate.fullName}
                  </span>
                  <span
                    className={cn('text-[13px] leading-[18px]', STATE_TONE[candidate.state.kind])}
                  >
                    {stateText(candidate.state)}
                  </span>
                </span>
                {row.picked && row.line ? (
                  <span className="flex flex-col items-end gap-0.5 text-right">
                    <span className="text-[15px] leading-5 font-semibold whitespace-nowrap tabular-nums">
                      {format.money(row.line.totalMinor, currency)}
                    </span>
                    <span className="text-[13px] leading-[18px] whitespace-nowrap text-muted-foreground">
                      {t('result', { count: row.line.lessons })}
                    </span>
                  </span>
                ) : (
                  <span />
                )}
              </label>

              {row.picked && debtLessons > 0 && row.line ? (
                <p className="ml-8.5 flex items-start gap-2 text-[13px] leading-[18px] text-muted-foreground [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0">
                  <InfoIcon />
                  {t('debtNote', {
                    count: debtLessons,
                    left: Math.max(row.line.lessons - debtLessons, 0),
                  })}
                </p>
              ) : null}

              {row.applied && candidate.ownRateMinor ? (
                <div className="ml-8.5 flex items-center justify-between gap-3 text-[13px] leading-[18px] text-tint-indigo-foreground">
                  <span className="flex items-center gap-1.5 [&_svg]:size-4">
                    <CheckIcon />
                    {t('ownApplied', { rate: format.money(candidate.ownRateMinor, currency) })}
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto p-0 text-muted-foreground underline"
                    onClick={() => onReset(candidate.studentId)}
                  >
                    {t('reset')}
                  </Button>
                </div>
              ) : row.ownHint ? (
                <Notice
                  appearance="callout"
                  tone="indigo"
                  icon={<BanknoteIcon />}
                  className="ml-8.5"
                  text={t('ownHint', {
                    rate: format.money(row.ownHint.rateMinor, currency),
                    lessons: row.ownHint.lessons,
                    rateShort: format.moneyParts(row.ownHint.rateMinor, currency).value,
                    total: format.money(row.ownHint.totalMinor, currency),
                  })}
                  action={
                    <Button
                      type="button"
                      variant="white"
                      size="xs"
                      onClick={() => onApply(candidate.studentId)}
                    >
                      {t('apply')}
                    </Button>
                  }
                />
              ) : null}

              {row.picked && pause ? (
                <Notice
                  appearance="callout"
                  tone="warning"
                  icon={<PauseIcon />}
                  className="ml-8.5"
                  text={
                    pause.endsAt
                      ? t('pauseNote', { date: format.shortDay(lastDayOf(pause.endsAt)) })
                      : t('pauseNoteOpen')
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-4 rounded-row bg-tint-indigo px-5 py-4 text-tint-foreground">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs leading-4 font-bold tracking-[0.06em] text-tint-indigo-foreground uppercase">
            {t('total')}
          </span>
          <span className="text-sm leading-5 text-tint-indigo-foreground">
            {total?.line ?? t('totalEmpty')}
          </span>
        </span>
        <span className="text-[26px] leading-8 font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums">
          {total?.amount ?? format.money(0, currency)}
        </span>
      </div>
    </section>
  );
}
