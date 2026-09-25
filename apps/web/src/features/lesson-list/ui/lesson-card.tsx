'use client';

import { RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DateTile } from '@/components/shared/date-tile';
import type { LessonPanelIntent } from '@/features/lessons';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { needsMakeup, paymentView } from '../model/payment';
import { dayKey } from '../model/filters';
import { PaymentCell, PriceCell, StatusCell, useLessonWhen, type ListLesson } from './lesson-cells';

/**
 * A lesson on the phone (S04): the date tile (ink for today), who, «time ·
 * teacher» and the price; under them the status with its chips and the
 * payment. The whole card opens the S01 panel.
 */
export function LessonCard({
  lesson,
  now,
  solo,
  quick,
  onOpen,
}: {
  lesson: ListLesson;
  now: number;
  solo: boolean;
  quick: string;
  onOpen: (lessonId: string, intent?: LessonPanelIntent) => void;
}) {
  const t = useTranslations('lessonList');
  const format = useLocalFormatter();
  const when = useLessonWhen();
  const start = new Date(lesson.startsAtUtc);
  const { range, day } = when(lesson);
  const who = lesson.group?.name ?? lesson.student?.fullName ?? '';
  const today = dayKey(start) === dayKey(new Date(now));
  return (
    <article className="relative flex flex-col gap-3 rounded-card bg-card p-4">
      <div className="flex items-start gap-3.5">
        <DateTile
          top={format.dateTime(start, { weekday: 'short' })}
          day={format.dateTime(start, { day: 'numeric' })}
          state={today ? 'highlighted' : 'default'}
          size={52}
        />
        <div className="flex min-w-0 grow flex-col gap-0.5 pt-1">
          <button
            type="button"
            onClick={() => onOpen(lesson.id)}
            aria-label={t('openLesson', { when: `${day}, ${range}`, who })}
            className="truncate text-left text-[17px] leading-[22px] font-semibold outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {who}
          </button>
          <span className="truncate text-sm leading-5 text-muted-foreground">
            {solo ? range : `${range} · ${lesson.teacher.name}`}
          </span>
        </div>
        <div className="pt-1">
          <PriceCell lesson={lesson} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <StatusCell lesson={lesson} className="flex-row flex-wrap items-center gap-2" />
        {quick === 'needs_makeup' && needsMakeup(lesson) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative z-10"
            onClick={() => onOpen(lesson.id, 'makeup')}
          >
            <RepeatIcon data-icon="inline-start" />
            {t('assign')}
          </Button>
        ) : (
          <PaymentCell view={paymentView(lesson)} className="ml-auto" />
        )}
      </div>
    </article>
  );
}
