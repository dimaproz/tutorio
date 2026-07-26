'use client';

import { useMemo, useState } from 'react';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { SectionTitle } from '@/components/app/detail-view';
import { LessonStatusBadge } from '@/components/app/status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { useDateFormatters } from '@/lib/i18n/format';
import { LessonActionsDialog } from './lesson-actions-dialog';
import { LessonFormDialog } from './lesson-form-dialog';

// How far back and forward a student's schedule is read on their profile.
const PAST_DAYS = 120;
const FUTURE_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

function LessonRow({
  lesson,
  when,
  onSelect,
}: {
  lesson: LessonResponse;
  /** Pre-formatted by the parent: one formatter for the whole list. */
  when: string;
  onSelect: (lesson: LessonResponse) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(lesson)}
        className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
      >
        <span className="tabular w-32 shrink-0 text-sm font-medium">{when}</span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
          {lesson.teacher.name}
        </span>
        <LessonStatusBadge status={lesson.status} />
      </button>
    </li>
  );
}

/**
 * The student's own schedule, right where the tutor already is. Upcoming and
 * past lessons plus a one-click booking that arrives with the student
 * pre-selected — no detour through the calendar.
 */
export function StudentLessonsCard({ studentId }: { studentId: string }) {
  const t = useTranslations('scheduling.studentLessons');
  const format = useDateFormatters();

  const [selected, setSelected] = useState<LessonResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Pinned once per mount: the window and the upcoming/past split must not
  // shift underneath the tutor on an unrelated re-render.
  const [now] = useState(() => Date.now());

  const range = useMemo(
    () => ({
      from: new Date(now - PAST_DAYS * DAY_MS).toISOString(),
      to: new Date(now + FUTURE_DAYS * DAY_MS).toISOString(),
    }),
    [now],
  );
  const lessons = useLessonsQuery({ ...range, studentId });

  const { upcoming, past } = useMemo(() => {
    const items = lessons.data?.items ?? [];
    return {
      upcoming: items.filter((item) => new Date(item.startsAtUtc).getTime() >= now),
      // Most recent first — the tutor looks backwards from today.
      past: items
        .filter((item) => new Date(item.startsAtUtc).getTime() < now)
        .reverse(),
    };
  }, [lessons.data, now]);

  const openLesson = (lesson: LessonResponse) => {
    setSelected(lesson);
    setActionsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={CalendarIcon} tone="primary">
          {t('title')}
        </SectionTitle>
        <CardAction>
          <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t('addLesson')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {lessons.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">
                {t('upcoming', { count: upcoming.length })}
              </TabsTrigger>
              <TabsTrigger value="past">{t('past', { count: past.length })}</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming">
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground py-3 text-sm">{t('noUpcoming')}</p>
              ) : (
                <ul className="flex flex-col gap-1 pt-2">
                  {upcoming.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      when={format.dayMonthTime(lesson.startsAtUtc)}
                      onSelect={openLesson}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="past">
              {past.length === 0 ? (
                <p className="text-muted-foreground py-3 text-sm">{t('noPast')}</p>
              ) : (
                <ul className="flex flex-col gap-1 pt-2">
                  {past.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      when={format.dayMonthTime(lesson.startsAtUtc)}
                      onSelect={openLesson}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <LessonActionsDialog
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        lesson={selected}
      />
      <LessonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lockedStudentId={studentId}
      />
    </Card>
  );
}
