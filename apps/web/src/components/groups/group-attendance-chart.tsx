'use client';

import { ChartNoAxesColumnIncreasingIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SectionTitle } from '@/components/app/detail-view';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type GroupAnalyticsPeriod = 'sixWeeks' | 'threeMonths';

/**
 * The attendance model is intentionally independent from lessons: one group
 * lesson can have different attendance for each student. The tabs and card are
 * ready for that source without presenting lesson completion as attendance.
 */
export function GroupAttendanceChart({
  period,
  onPeriodChange,
}: {
  period: GroupAnalyticsPeriod;
  onPeriodChange: (period: GroupAnalyticsPeriod) => void;
}) {
  const t = useTranslations('groups.detail');

  function changePeriod(value: string) {
    onPeriodChange(value as GroupAnalyticsPeriod);
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={ChartNoAxesColumnIncreasingIcon} tone="success">
          {t('attendanceTitle')}
        </SectionTitle>
        <CardDescription>{t('attendanceDescription')}</CardDescription>
        <CardAction>
          <Tabs value={period} onValueChange={changePeriod}>
            <TabsList variant="segmented" size="sm">
              <TabsTrigger value="sixWeeks">{t('period.sixWeeks')}</TabsTrigger>
              <TabsTrigger value="threeMonths">{t('period.threeMonths')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Empty className="min-h-52 border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{t('attendanceEmptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('attendanceEmptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
