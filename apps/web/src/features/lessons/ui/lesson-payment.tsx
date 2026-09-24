'use client';

import { useMemo } from 'react';
import { CheckIcon, CircleSlashIcon, CircleXIcon, HourglassIcon, UserXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonDetailResponse, PackageResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LessonPaymentCard } from '@/components/shared/lesson-payment-card';
import { useEnrollmentBillingQuery, useLessonsQuery, usePackageQuery } from '../api';
import { payingPackageId, paymentView, type PaymentView } from '../model/payment';
import { useLessonDates, useMoney, useMoneyParts } from './lesson-format';

/** How far ahead the direction's lessons are read to find what comes before and after. */
const AHEAD_MS = 120 * 24 * 3_600_000;

/**
 * Everything the payment block needs for an individual lesson: the
 * direction's billing, the package paying for it, the lessons booked before
 * it (they draw their credits first) and the next one after it.
 */
export function useLessonPayment(lesson: LessonDetailResponse, now: number) {
  const enrollmentId = lesson.groupId ? null : lesson.enrollmentId;
  const billing = useEnrollmentBillingQuery(enrollmentId);
  const packageId = payingPackageId(lesson, billing.data);
  const pkg = usePackageQuery(packageId ?? '', Boolean(packageId));

  const upcoming = lesson.status === 'SCHEDULED' && Boolean(enrollmentId);
  const from = new Date(Math.min(now, Date.parse(lesson.startsAtUtc))).toISOString();
  const to = new Date(Date.parse(lesson.startsAtUtc) + AHEAD_MS).toISOString();
  const lessons = useLessonsQuery({ from, to, enrollmentId: enrollmentId ?? undefined }, upcoming);

  const view = useMemo<PaymentView>(() => {
    if (!enrollmentId) return { kind: 'pending' };
    if (upcoming && lessons.isPending) return { kind: 'pending' };
    const scheduled = (lessons.data?.items ?? []).filter(
      (item) => item.status === 'SCHEDULED' && item.id !== lesson.id,
    );
    const start = Date.parse(lesson.startsAtUtc);
    const lessonsBefore = scheduled.filter(
      (item) => Date.parse(item.startsAtUtc) < start && Date.parse(item.startsAtUtc) >= now,
    ).length;
    const next = scheduled.find((item) => Date.parse(item.startsAtUtc) > start);
    return paymentView({
      lesson,
      billing: billing.data,
      pkg: billing.isPending ? undefined : packageId ? pkg.data : null,
      lessonsBefore,
      nextLessonAt: next?.startsAtUtc ?? null,
    });
  }, [
    billing.data,
    billing.isPending,
    enrollmentId,
    lesson,
    lessons.data,
    lessons.isPending,
    now,
    packageId,
    pkg.data,
    upcoming,
  ]);

  return { view, billing: billing.data, pkg: pkg.data ?? null };
}

function packageLine(
  view: Extract<PaymentView, { kind: 'package' }>,
  t: ReturnType<typeof useTranslations<'lessons.payment'>>,
  money: ReturnType<typeof useMoney>,
  dates: ReturnType<typeof useLessonDates>,
) {
  const pkg = view.package;
  const values = {
    name: pkg.name ?? t('label.package'),
    price: money(pkg.totalPriceMinor, pkg.currency),
  };
  return pkg.expiresAt
    ? t('packageLineUntil', { ...values, date: dates.dayMonth(pkg.expiresAt) })
    : t('packageLine', values);
}

/** The payment block of an individual lesson (S01 decision 1). */
export function LessonPayment({
  view,
  lesson,
  pkg,
}: {
  view: PaymentView;
  lesson: LessonDetailResponse;
  pkg: PackageResponse | null;
}) {
  const t = useTranslations('lessons.payment');
  const money = useMoney();
  const moneyParts = useMoneyParts();
  const dates = useLessonDates();

  switch (view.kind) {
    case 'pending':
      return <Skeleton className="h-42.5 w-full shrink-0 rounded-block" />;

    case 'freeMakeup':
      return (
        <LessonPaymentCard
          tone="sky"
          art="check"
          label={t('label.makeup')}
          badge={
            <Badge variant="on-tint">
              <CircleSlashIcon data-icon="inline-start" />
              {t('noCharge')}
            </Badge>
          }
          headline={t('free')}
          text={
            view.originalStartsAt
              ? t('freeMakeup', { date: dates.dayMonth(view.originalStartsAt) })
              : undefined
          }
        />
      );

    case 'packageEmpty':
      return (
        <LessonPaymentCard
          tone="warning"
          art="cards"
          label={t('label.package')}
          headline={view.state === 'upcoming' ? t('emptyUpcoming') : t('emptyCharged')}
          text={view.state === 'upcoming' ? t('emptyUpcomingText') : t('emptyChargedText')}
        />
      );

    case 'oneOff': {
      const parts = moneyParts(view.amountMinor, view.currency);
      const moneyFigure = { value: parts.value, unit: parts.symbol, kind: 'money' as const };
      if (view.state === 'paid') {
        return (
          <LessonPaymentCard
            tone="success"
            art="check"
            label={t('label.oneOff')}
            figure={moneyFigure}
            chips={
              <Badge variant="on-tint">
                <CheckIcon data-icon="inline-start" />
                {view.paidAt ? t('paidOn', { date: dates.dayMonth(view.paidAt) }) : t('paid')}
              </Badge>
            }
          />
        );
      }
      if (view.state === 'unpaid') {
        return (
          <LessonPaymentCard
            tone="warning"
            art="cards"
            label={t('label.oneOff')}
            figure={moneyFigure}
            text={t('chargedUnpaid', {
              date: dates.dayMonth(view.chargedAt ?? lesson.startsAtUtc),
            })}
          />
        );
      }
      return (
        <LessonPaymentCard
          tone="sky"
          art="cards"
          label={t('label.oneOff')}
          badge={
            view.state === 'free' ? (
              <Badge variant="on-tint">
                <CircleSlashIcon data-icon="inline-start" />
                {t('notCharged')}
              </Badge>
            ) : undefined
          }
          figure={moneyFigure}
          text={
            view.state === 'free'
              ? t('freeOneOff')
              : t('willCharge', {
                  date: dates.dayMonth(lesson.startsAtUtc),
                  time: dates.endTime(lesson),
                })
          }
        />
      );
    }

    case 'package': {
      const badge =
        view.state === 'upcoming' ? (
          view.last ? (
            <Badge variant="warning">
              <HourglassIcon data-icon="inline-start" />
              {t('lastInPackage')}
            </Badge>
          ) : pkg && pkg.paymentStatus !== 'PAID' ? (
            <Badge variant="on-tint">{t('packageNotPaid')}</Badge>
          ) : (
            <Badge variant="on-tint">
              <CheckIcon data-icon="inline-start" />
              {t('packagePaid')}
            </Badge>
          )
        ) : view.state === 'free' ? (
          <Badge variant="on-tint">
            <CircleSlashIcon data-icon="inline-start" />
            {t('notCharged')}
          </Badge>
        ) : view.reason === 'noShow' ? (
          <Badge variant="danger">
            <UserXIcon data-icon="inline-start" />
            {t('chargedNoShow')}
          </Badge>
        ) : view.reason === 'lateCancel' ? (
          <Badge variant="danger">
            <CircleXIcon data-icon="inline-start" />
            {t('chargedLate')}
          </Badge>
        ) : (
          <Badge variant="on-tint">
            <CheckIcon data-icon="inline-start" />
            {t('chargedHeld')}
          </Badge>
        );
      const caption =
        view.state === 'upcoming'
          ? t('leftAfter', { count: view.left })
          : view.state === 'free'
            ? t('leftFree', { count: view.left })
            : t('leftNow', { count: view.left });
      const legend =
        view.state === 'upcoming'
          ? { segment: 'current' as const, label: t('legend.current') }
          : view.state === 'free'
            ? { segment: 'available' as const, label: t('legend.available') }
            : view.reason === 'noShow'
              ? { segment: 'charged' as const, label: t('legend.noShow') }
              : view.reason === 'lateCancel'
                ? { segment: 'charged' as const, label: t('legend.lateCancel') }
                : { segment: 'used' as const, label: t('legend.used') };
      return (
        <LessonPaymentCard
          tone="indigo"
          art="rings"
          label={t('label.package')}
          badge={badge}
          figure={{
            value: String(view.left),
            unit: t('of', { total: view.package.lessonsTotal }),
            caption,
            kind: 'count',
          }}
          segments={view.segments}
          detail={packageLine(view, t, money, dates)}
          legend={legend}
          footer={
            view.last
              ? {
                  text: view.nextLessonAt
                    ? t('nextNotCovered', { date: dates.dayMonth(view.nextLessonAt) })
                    : t('lastCredit'),
                }
              : undefined
          }
        />
      );
    }
  }
}
