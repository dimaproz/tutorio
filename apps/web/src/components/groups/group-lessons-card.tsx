'use client';

import { useState } from 'react';
import {
  CalendarCheck2Icon,
  CalendarClockIcon,
  CalendarPlusIcon,
  CalendarX2Icon,
  Repeat2Icon,
} from 'lucide-react';
import type { LessonResponse } from '@tutorio/validation';
import { useTranslations } from 'next-intl';
import { MetricCard } from '@/components/app/metric-card';
import { SectionTitle } from '@/components/app/detail-view';
import { LessonStatusBadge } from '@/components/app/status-badges';
import { LessonFormDialog } from '@/components/scheduling/lesson-form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { useDateFormatters } from '@/lib/i18n/format';

function isCancelled(lesson: LessonResponse) {
  return lesson.status === 'CANCELLED_CHARGED' || lesson.status === 'CANCELLED_UNCHARGED';
}

/** Lessons and their period statistics in the context of one group. */
export function GroupLessonsCard({
  groupId,
  lessons,
  pending,
}: {
  groupId: string;
  lessons: LessonResponse[];
  pending: boolean;
}) {
  const t = useTranslations('groups.detail');
  const format = useDateFormatters();
  const [formOpen, setFormOpen] = useState(false);
  const now = new Date();
  const summary = lessons.reduce(
    (result, lesson) => {
      if (isCancelled(lesson)) {
        result.cancelled += 1;
      } else if (lesson.status === 'COMPLETED') {
        result.completed += 1;
      } else if (lesson.rescheduledCount > 0) {
        result.rescheduled += 1;
      } else {
        result.scheduled += 1;
      }
      return result;
    },
    { completed: 0, scheduled: 0, cancelled: 0, rescheduled: 0 },
  );
  const upcoming = lessons
    .filter((lesson) => lesson.status === 'SCHEDULED' && new Date(lesson.startsAtUtc) >= now)
    .sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc))
    .slice(0, 4);

  return (
    <>
      <Card>
        <CardHeader>
          <SectionTitle icon={CalendarCheck2Icon} tone="primary">
            {t('lessonsTitle')}
          </SectionTitle>
          <CardDescription>{t('lessonsDescription', { count: lessons.length })}</CardDescription>
          <CardAction>
            <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
              <CalendarPlusIcon data-icon="inline-start" />
              {t('addLesson')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CalendarCheck2Icon}
              tone="success"
              label={t('lessonStats.completed')}
              value={summary.completed}
            />
            <MetricCard
              icon={CalendarClockIcon}
              tone="primary"
              label={t('lessonStats.scheduled')}
              value={summary.scheduled}
            />
            <MetricCard
              icon={CalendarX2Icon}
              tone="destructive"
              label={t('lessonStats.cancelled')}
              value={summary.cancelled}
            />
            <MetricCard
              icon={Repeat2Icon}
              tone="warning"
              label={t('lessonStats.rescheduled')}
              value={summary.rescheduled}
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-medium">{t('upcomingLessons')}</h3>
            {pending ? (
              <p className="text-sm text-muted-foreground">{t('loadingLessons')}</p>
            ) : upcoming.length === 0 ? (
              <Empty className="border border-dashed py-6">
                <EmptyHeader>
                  <EmptyTitle>{t('noUpcomingLessons')}</EmptyTitle>
                  <EmptyDescription>{t('noUpcomingLessonsDescription')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((lesson) => (
                  <li key={lesson.id}>
                    <Item variant="outline">
                      <ItemContent>
                        <ItemTitle>{lesson.notes || t('lessonFallbackTitle')}</ItemTitle>
                        <ItemDescription>
                          {format.dayMonthTime(lesson.startsAtUtc)} ·{' '}
                          {t('durationMinutes', {
                            minutes: lesson.durationMin,
                          })}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <LessonStatusBadge status={lesson.status} />
                      </ItemActions>
                    </Item>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <LessonFormDialog open={formOpen} onOpenChange={setFormOpen} lockedGroupId={groupId} />
    </>
  );
}
