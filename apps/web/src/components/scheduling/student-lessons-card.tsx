'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { SectionTitle } from '@/components/app/detail-view';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingPanel } from '@/components/shared';
import { Tabs, TabsBadge, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { LessonActionsDialog, type LessonDialogMode } from './lesson-actions-dialog';
import { LessonFormDialog } from './lesson-form-dialog';
import { LessonsTable } from './lessons-table';

// How far back and forward a student's schedule is read on their profile.
const PAST_DAYS = 120;
const FUTURE_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The student's own schedule, right where the tutor already is. Upcoming and
 * past lessons plus a one-click booking that arrives with the student
 * pre-selected — no detour through the calendar.
 */
export function StudentLessonsCard({ studentId }: { studentId: string }) {
  const t = useTranslations('scheduling.studentLessons');

  const [selected, setSelected] = useState<LessonResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsMode, setActionsMode] = useState<LessonDialogMode>('menu');
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

  // One dialog for the whole card: the row menu only says which panel to show.
  const openLesson = useCallback((lesson: LessonResponse, mode: LessonDialogMode = 'menu') => {
    setSelected(lesson);
    setActionsMode(mode);
    setActionsOpen(true);
  }, []);

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
          <LoadingPanel size="md" className="min-h-32 rounded-xl border-0 bg-transparent" />
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList size="sm">
              <TabsTrigger value="upcoming">
                {t('upcoming')}
                <TabsBadge>{upcoming.length}</TabsBadge>
              </TabsTrigger>
              <TabsTrigger value="past">
                {t('past')}
                <TabsBadge>{past.length}</TabsBadge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="pt-3">
              <LessonsTable
                lessons={upcoming}
                emptyMessage={t('noUpcoming')}
                loading={lessons.isFetching}
                onOpenDialog={openLesson}
              />
            </TabsContent>
            <TabsContent value="past" className="pt-3">
              <LessonsTable
                lessons={past}
                emptyMessage={t('noPast')}
                loading={lessons.isFetching}
                onOpenDialog={openLesson}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <LessonActionsDialog
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        lesson={selected}
        initialMode={actionsMode}
      />
      <LessonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lockedStudentId={studentId}
      />
    </Card>
  );
}
