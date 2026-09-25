'use client';

import { useTranslations } from 'next-intl';
import type { TeacherResponse, TeacherSummary } from '@tutorio/validation';
import { StatBlock } from '@/components/shared/stat-block';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { workload } from '../model/presentation';
import { useTeacherRate } from './teacher-parts';

/**
 * The profile's four metrics (S09 board 02): the workload in hours with six
 * weeks of bars, the students with their groups, what was held this month
 * with the misses and the students' cancellations, and the default rate. A
 * row of four on a desktop, two by two below, the phone's small blocks.
 */
export function TeacherMetrics({
  teacher,
  summary,
}: {
  teacher: TeacherResponse;
  summary: TeacherSummary | undefined;
}) {
  const t = useTranslations('teachers.profile.metrics');
  const mobile = useIsMobile();
  const rate = useTeacherRate()(teacher);

  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-block md:h-46" />
        ))}
      </div>
    );
  }

  const load = workload(summary);
  const month = Number(summary.month.start.slice(5, 7));
  const size = mobile ? 'sm' : 'md';

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatBlock
        type="chart"
        chart="bars"
        size={size}
        label={t('load')}
        value={t('hours', { count: load.hours })}
        data={load.bars}
        caption={mobile ? t('thisWeek') : t('average', { count: load.averageHours })}
      />
      <StatBlock
        type="amount"
        size={size}
        label={t('students')}
        value={summary.students.total}
        aside={summary.groupCount}
        asideLabel={t('groups', { count: summary.groupCount })}
        caption={
          mobile
            ? t('studentsShort', { count: summary.groupCount })
            : t('studentsCaption', {
                individual: summary.students.individual,
                groups: summary.students.inGroups,
              })
        }
      />
      <StatBlock
        type="amount"
        size={size}
        label={mobile ? t('heldShort') : t('held', { month })}
        value={summary.month.held}
        aside={summary.month.noShows}
        asideLabel={t('noShows', { count: summary.month.noShows })}
        caption={
          mobile
            ? t('heldShortCaption', { month, count: summary.month.noShows })
            : t('cancelled', { count: summary.month.cancelledByStudents })
        }
      />
      <StatBlock
        type="amount"
        tone="tint"
        size={size}
        label={t('rate')}
        value={rate?.text ?? t('rateNone')}
        caption={rate ? (mobile ? t('rateShort') : t('rateCaption')) : t('rateNoneCaption')}
      />
    </div>
  );
}
