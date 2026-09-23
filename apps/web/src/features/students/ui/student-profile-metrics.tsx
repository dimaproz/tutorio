'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { StatBlock } from '@/components/shared/stat-block';
import { Skeleton } from '@/components/ui/skeleton';
import type { StudentProfileMetrics as Metrics } from '@/features/students/model/profile-metrics';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatMoneyCompact } from '@/lib/money';

/**
 * The profile metric band: credits left, money received, attendance and the
 * level. Every figure is read from the student's packages and lessons; a
 * student without them shows zeros and the next step. Only a read that
 * failed, or money in several currencies, shows a dash with the reason.
 */
export function StudentProfileMetrics({
  student,
  metrics,
  onAddPackage,
}: {
  student: StudentDetail;
  /** Undefined while the packages and lessons load. */
  metrics?: Metrics;
  onAddPackage?: () => void;
}) {
  const t = useTranslations('students.profileMetrics');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const locale = useLocale();
  const format = useFormatter();
  const mobile = useIsMobile();
  const loading = <Skeleton className="h-10 w-20" />;

  const price =
    student.hourlyRateMinor != null && student.currency
      ? formatMoneyCompact(student.hourlyRateMinor, student.currency, locale).text
      : undefined;
  const credits = metrics?.credits;
  const paid = metrics?.paid;
  const attendance = metrics?.attendance;
  const paidMoney = formatMoneyCompact(
    paid?.paidMinor ?? 0,
    paid?.currency ?? student.currency ?? 'UAH',
    locale,
  );
  // Unknown or not summable: a zero here would read as "nothing paid".
  const unknownPaid = Boolean(metrics && !paid && (metrics.packagesUnavailable || metrics.mixedCurrency));
  const shortDate = (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'short' });

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-4 [&>*]:w-65 [&>*]:shrink-0 md:[&>*]:w-auto">
      {!metrics ? (
        <StatBlock type="amount" label={t('creditsLeft')} value={loading} />
      ) : metrics.packagesUnavailable ? (
        <StatBlock type="amount" label={t('creditsLeft')} value="—" caption={t('unavailable')} />
      ) : credits && credits.total > 0 ? (
        <StatBlock
          type="chart"
          chart="ring"
          label={t('creditsLeft')}
          value={t('creditsValue', { left: credits.left, total: credits.total })}
          percent={(credits.left / credits.total) * 100}
          caption={
            credits.packageName ? t('packageNamed', { name: credits.packageName }) : t('package')
          }
          detail={mobile ? undefined : t('used', { count: credits.used })}
        />
      ) : (
        <StatBlock
          type="amount"
          label={t('creditsLeft')}
          value="0"
          action={onAddPackage ? { label: t('addPackage'), onClick: onAddPackage } : undefined}
          caption={onAddPackage ? undefined : t('noPackage')}
        />
      )}

      <StatBlock
        type="amount"
        label={t('paidThisTerm')}
        value={!metrics ? loading : paid ? paidMoney.value : unknownPaid ? '—' : paidMoney.value}
        unit={metrics && !unknownPaid ? paidMoney.symbol : undefined}
        badge={
          !paid
            ? undefined
            : paid.owedMinor > 0
              ? {
                  label: t('debt', {
                    amount: formatMoneyCompact(paid.owedMinor, paid.currency, locale).text,
                  }),
                  tone: 'warning',
                }
              : { label: t('noDebt'), tone: 'success' }
        }
        caption={
          !metrics
            ? undefined
            : paid
              ? t('paidCaption', { date: shortDate(paid.lastPurchaseAt), count: paid.packages })
              : metrics.packagesUnavailable
                ? t('unavailable')
                : metrics.mixedCurrency
                  ? t('mixedCurrency')
                  : t('noPayments')
        }
        detail={!mobile && price ? t('perLesson', { price }) : undefined}
        aside={mobile && price ? price : undefined}
        asideLabel={mobile && price ? t('perLessonShort') : undefined}
      />

      {attendance ? (
        <StatBlock
          type="chart"
          chart="segments"
          label={t('attendance')}
          value={`${attendance.percent}%`}
          data={attendance.marks}
          caption={t('attendanceCaption', {
            attended: attendance.attended,
            charged: attendance.charged,
          })}
        />
      ) : (
        <StatBlock
          type="date"
          label={t('attendance')}
          value={!metrics ? loading : metrics.lessonsUnavailable ? '—' : t('attendanceNone')}
          sub={metrics && !metrics.lessonsUnavailable ? t('attendanceNoneSub') : undefined}
          caption={
            !metrics
              ? undefined
              : metrics.lessonsUnavailable
                ? t('unavailable')
                : t('attendanceNoneCaption')
          }
        />
      )}

      {/* The value zone holds a short mark, so the CEFR code leads and the
          localized level name — which can run to several words — is the sub. */}
      <StatBlock
        type="date"
        tone="tint"
        label={t('level')}
        value={student.languageLevel ?? t('levelNone')}
        sub={
          student.languageLevel
            ? tLanguage(student.languageLevel).split(' — ')[1]
            : t('levelNoneSub')
        }
        caption={
          student.knowledgeLevel
            ? t('knowledgeCaption', { level: tKnowledge(student.knowledgeLevel) })
            : student.languageLevel
              ? t('levelCaption')
              : t('levelMissing')
        }
      />
    </div>
  );
}
