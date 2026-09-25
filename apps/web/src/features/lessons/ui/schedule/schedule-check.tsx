'use client';

import { ChevronLeftIcon, PackageIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScheduleCreatePreview } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { ConflictPairs, DateCards } from './schedule-parts';

/**
 * «Перевірте розклад» (S05 board 02, states 05–06): how many lessons the new
 * schedule creates with its rule and range, the dates as cards, what they
 * overlap, and what happens next — the daily top-up (L-22) and the package
 * it uses. With conflicts the save is «Створити попри накладки» (L-111).
 */
export function ScheduleCheckDialog({
  open,
  onOpenChange,
  subtitle,
  who,
  rule,
  horizonWeeks,
  preview,
  durationMin,
  credits,
  busy,
  onBack,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** «Anna Shevchenko · Dmytro Tutor». */
  subtitle: string;
  /** The new lessons' name in the conflict pairs. */
  who: string;
  /** «Пн 17:00 · Чт 15:00 · по 60 хв». */
  rule: string;
  horizonWeeks: number;
  preview: ScheduleCreatePreview;
  durationMin: number;
  /** The student's package, when the lessons are paid from one. */
  credits: { owner: string; left: number; total: number | null } | null;
  busy: boolean;
  onBack: () => void;
  onConfirm: (force: boolean) => void;
}) {
  const t = useTranslations('schedules.check');
  const tPanel = useTranslations('lessons.panel');
  const mobile = useIsMobile();
  const format = useLocalFormatter();
  const { dates, conflicts } = preview;
  const conflicting = new Set(conflicts.map((conflict) => conflict.candidateStartsAtUtc));
  const first = dates[0];
  const last = dates.at(-1);
  const range =
    first && last
      ? format.dateTimeRange(new Date(first), new Date(last), { day: 'numeric', month: 'long' })
      : '';

  const impact: ImpactItem[] = [
    {
      id: 'topUp',
      icon: <RepeatIcon />,
      tone: 'indigo',
      title: t('topUp'),
      text: t('topUpText', { weeks: horizonWeeks }),
    },
  ];
  if (credits) {
    const debt = Math.max(0, dates.length - credits.left);
    impact.push({
      id: 'package',
      icon: <PackageIcon />,
      tone: 'success',
      title: t('package', { name: credits.owner }),
      text:
        credits.total === null
          ? t('packageLeftShort', { left: credits.left })
          : debt > 0
            ? t('packageDebt', { left: credits.left, total: credits.total, debt })
            : t('packageLeft', { left: credits.left, total: credits.total }),
    });
  }

  const back = (
    <Button type="button" variant={mobile ? 'outline' : 'ghost'} disabled={busy} onClick={onBack}>
      {mobile ? null : <ChevronLeftIcon data-icon="inline-start" />}
      {t('back')}
    </Button>
  );

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="xl"
      sheetLayout="compact"
      closeLabel={tPanel('close')}
      icon={<RepeatIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={mobile ? undefined : subtitle}
      tertiary={mobile ? undefined : back}
      secondary={
        mobile ? (
          back
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
        )
      }
      primary={
        <Button type="button" disabled={busy} onClick={() => onConfirm(conflicts.length > 0)}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {conflicts.length > 0
            ? mobile
              ? t('createShort')
              : t('createAnyway')
            : mobile
              ? t('createShort')
              : t('create')}
        </Button>
      }
    >
      <Card tone="indigo" className="flex-row items-center gap-5 rounded-card px-6 py-5">
        <span className="text-[56px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
          {preview.created}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-lg leading-6 font-semibold">
            {t('willCreate', { count: preview.created })}
          </span>
          <span className="text-[15px] leading-6">{rule}</span>
          {range ? (
            <span className="text-[15px] leading-6">
              {t('range', { range, weeks: horizonWeeks })}
            </span>
          ) : null}
        </div>
      </Card>
      {dates.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {t('dates')}
          </h3>
          <DateCards dates={dates} conflicting={conflicting} />
        </section>
      ) : null}
      {conflicts.length > 0 ? (
        <ConflictPairs
          conflicts={conflicts}
          durationMin={durationMin}
          title={who}
          newLabel={t('new')}
          mobile={mobile}
        />
      ) : null}
      <ImpactList items={impact} label={t('next')} />
    </AdaptiveDialog>
  );
}
