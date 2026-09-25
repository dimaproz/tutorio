'use client';

import { useState } from 'react';
import { BanknoteIcon, CircleCheckIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PackageResponse, ScheduleResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ScheduleChangeDialog, ScheduleCreateDialog } from '@/features/lessons';
import { usePackageDetailQuery } from '../../api';
import { lastDayOf } from '../../model/dates';
import { directionName, packageLine } from '../../model/names';
import { owedMinor } from '../../model/ticket';
import { PackagePaymentDialog } from '../operations/payment-dialog';
import { usePackageFormat } from '../use-package-format';
import { usePackageTitle } from '../use-package-title';
import { SoldTicket } from './sale-ticket';

/**
 * «Пакет продано» (board 01, state 06): the sold package as a ticket and
 * «Що далі» — the schedule it will pay for (or that there is none yet) with
 * «Записати оплату · 4 000 ₴» and «Відкрити розклад» (L-87: the sale did
 * neither). A sheet with the ticket upright on phones.
 */
export function SoldDialog({
  pkg: sold,
  schedule,
  mobile,
  nowMs,
  onClose,
}: {
  pkg: PackageResponse;
  schedule: ScheduleResponse | null;
  mobile: boolean;
  nowMs: number;
  onClose: () => void;
}) {
  const t = useTranslations('packages.sold');
  const format = usePackageFormat();
  const titleOf = usePackageTitle();
  const detail = usePackageDetailQuery(sold.id);
  const pkg = detail.data ?? sold;
  const [next, setNext] = useState<'pay' | 'schedule' | null>(null);
  const currency = pkg.currency;
  const owed = owedMinor(pkg);
  const title = titleOf(pkg);
  const lessons = Math.max(pkg.remainingCredits, 0);
  const window =
    pkg.sizingMode !== 'FIXED_COUNT' && pkg.validFrom && pkg.expiresAt
      ? format.dayRange(pkg.validFrom, lastDayOf(pkg.expiresAt))
      : pkg.expiresAt
        ? t('until', { date: format.dayMonth(lastDayOf(pkg.expiresAt)) })
        : t('noEnd');

  return (
    <>
      <AdaptiveDialog
        open
        onOpenChange={(open) => (open ? undefined : onClose())}
        closeLabel={t('close')}
        size="xl"
        icon={<CircleCheckIcon />}
        iconClassName="bg-tint-success text-tint-success-foreground"
        title={t('title')}
        description={`${pkg.student.fullName} · ${directionName(pkg)}`}
        primary={
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('done')}
          </Button>
        }
      >
        <SoldTicket
          mobile={mobile}
          label={t('label')}
          lessons={lessons}
          lessonsWord={t('lessonsWord', { count: lessons })}
          window={window}
          title={title}
          line={packageLine(pkg).join(' · ')}
          teacher={{ name: pkg.teacher.name, avatarKey: pkg.teacher.avatarKey }}
          figures={[
            {
              label: t('perLesson'),
              value: format.money(pkg.pricePerLessonMinorSnapshot, currency),
            },
            { label: t('total'), value: format.money(pkg.totalPriceMinorSnapshot, currency) },
            { label: t('paid'), value: format.money(pkg.paidMinor, currency) },
          ]}
          paidNote={owed > 0 ? (pkg.paidMinor > 0 ? t('paidPart') : t('notPaid')) : t('paidFull')}
          paid={owed === 0}
        />
        <section aria-label={t('next')} className="flex flex-col gap-3">
          <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
            {t('next')}
          </span>
          <p className="text-sm text-muted-foreground">
            {schedule
              ? t('scheduleExists', { schedule: format.scheduleDays(schedule) })
              : t('scheduleNone')}
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            {owed > 0 ? (
              <Button type="button" onClick={() => setNext('pay')}>
                <BanknoteIcon data-icon="inline-start" />
                {t('pay', { amount: format.money(owed, currency) })}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setNext('schedule')}>
              <RepeatIcon data-icon="inline-start" />
              {schedule ? t('openSchedule') : t('addSchedule')}
            </Button>
          </div>
        </section>
      </AdaptiveDialog>

      {next === 'pay' ? (
        <PackagePaymentDialog
          pkg={pkg}
          title={title}
          onClose={() => setNext(null)}
          onDone={() => setNext(null)}
        />
      ) : null}
      {next === 'schedule' && schedule ? (
        <ScheduleChangeDialog
          open
          onOpenChange={(open) => (open ? undefined : setNext(null))}
          schedule={schedule}
          nowMs={nowMs}
        />
      ) : null}
      {next === 'schedule' && !schedule ? (
        <ScheduleCreateDialog
          open
          onOpenChange={(open) => (open ? undefined : setNext(null))}
          initial={pkg.groupId ? { groupId: pkg.groupId } : { studentId: pkg.studentId }}
          nowMs={nowMs}
        />
      ) : null}
    </>
  );
}
