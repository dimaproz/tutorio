'use client';

import { LayersIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { capitalizeFirst } from '@/lib/utils';
import { lessonsByDay, type BulkCancelLesson } from '../../model/bulk-cancel';
import { useLessonDates } from '../lesson-format';

/**
 * The check step's list (S04): the lessons a bulk cancel calls off, by day —
 * «Ср, 14 жовт. · 4 заняття», then the time, who and «teacher · kind» — and
 * how many more there are when the preview names only its first ones.
 */
export function BulkCancelDays({
  lessons,
  more,
}: {
  lessons: readonly BulkCancelLesson[];
  /** Lessons beyond the ones the preview lists. */
  more: number;
}) {
  const t = useTranslations('lessons.bulkCancel');
  const format = useFormatter();
  const dates = useLessonDates();
  const timeZone = useStudioTimeZone();
  return (
    <section
      aria-label={t('listLabel')}
      className="flex flex-col gap-4 rounded-card bg-secondary px-4 py-4"
    >
      {lessonsByDay(lessons, timeZone).map(({ day, lessons: items }) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-[15px] leading-5">
            <span className="font-semibold">
              {capitalizeFirst(
                format.dateTime(new Date(day), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }),
              )}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {t('dayCount', { count: items.length })}
            </span>
            <span aria-hidden="true" className="h-px grow bg-border" />
          </h3>
          <ul className="flex flex-col gap-1">
            {items.map((lesson) => {
              const group = lesson.group !== null;
              return (
                <li key={lesson.id} className="flex min-h-14 items-center gap-3">
                  <span className="w-12 shrink-0 text-[15px] font-semibold tabular-nums">
                    {dates.time(lesson.startsAtUtc)}
                  </span>
                  {group ? (
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-item bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5"
                    >
                      <LayersIcon />
                    </span>
                  ) : (
                    <EntityAvatar fullName={lesson.student?.fullName ?? ''} size="sm" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] leading-5 font-semibold">
                      {lesson.group?.name ?? lesson.student?.fullName ?? ''}
                    </span>
                    <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
                      {t('lessonMeta', {
                        teacher: lesson.teacher.name,
                        kind: t(group ? 'kindGroup' : 'kindIndividual'),
                      })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {more > 0 ? (
        <p className="text-[13px] text-muted-foreground">{t('more', { count: more })}</p>
      ) : null}
    </section>
  );
}
