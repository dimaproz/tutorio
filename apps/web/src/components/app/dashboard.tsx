'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import {
  CalendarCheckIcon,
  CalendarIcon,
  ChevronRightIcon,
  SparklesIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { LessonActionsDialog } from '@/components/scheduling/lesson-actions-dialog';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { LessonStatusBadge } from '@/components/app/status-badges';
import { StatTile } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { useDateFormatters } from '@/lib/i18n/format';
import { useSession } from './session-provider';

export function DashboardWelcome() {
  const t = useTranslations('app.dashboard');
  const session = useSession();

  return (
    <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
      {t('welcome', { name: session.user.name })}
    </h2>
  );
}

export function DashboardEmptyState() {
  const t = useTranslations('app.dashboard');

  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
        <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * "Today" dashboard widget — the tutor's morning landing view. Queries the
 * current week once, then derives today's lessons and the week count from it.
 * A row opens the shared lesson actions dialog (complete / cancel / reactivate).
 */
export function DashboardToday() {
  const t = useTranslations('app.dashboard');
  const format = useDateFormatters();

  const [selected, setSelected] = useState<LessonResponse | null>(null);
  const [open, setOpen] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    };
  }, []);
  const lessons = useLessonsQuery(range);

  const items = useMemo(() => lessons.data?.items ?? [], [lessons.data]);
  const today = useMemo(() => {
    const from = startOfDay(new Date()).getTime();
    const to = endOfDay(new Date()).getTime();
    return items
      .filter((lesson) => {
        const at = new Date(lesson.startsAtUtc).getTime();
        return at >= from && at <= to;
      })
      .sort(
        (a, b) =>
          new Date(a.startsAtUtc).getTime() - new Date(b.startsAtUtc).getTime(),
      );
  }, [items]);

  const dateLabel = format.weekdayLongDate(new Date());

  if (lessons.isPending) {
    return <ListSkeleton rows={4} />;
  }
  if (lessons.isError) {
    return (
      <QueryErrorAlert
        error={lessons.error}
        title={t('today')}
        onRetry={() => void lessons.refetch()}
      />
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label={t('lessonsToday')}
          value={today.length}
          icon={CalendarIcon}
          tone="primary"
        />
        <StatTile
          label={t('lessonsWeek')}
          value={items.length}
          icon={CalendarCheckIcon}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="text-muted-foreground size-4" />
            {t('today')}
          </CardTitle>
          <CardDescription className="capitalize">{dateLabel}</CardDescription>
          <CardAction className="flex items-center gap-2">
            {/* A background refresh should be visible but must not blank the list. */}
            {lessons.isFetching ? (
              <Spinner className="text-muted-foreground size-3.5" />
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/app/calendar">{t('openCalendar')}</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {today.length === 0 ? (
            // The calendar exists — say what is actually missing and offer the
            // next step, rather than a generic "workspace is ready" screen.
            <Empty className="border border-dashed py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {items.length === 0 ? t('noneThisWeek') : t('noToday')}
                </EmptyTitle>
                <EmptyDescription>{t('noneThisWeekHint')}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/app/calendar">{t('openCalendar')}</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {today.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(lesson);
                      setOpen(true);
                    }}
                    className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors"
                  >
                    <span className="tabular text-sm font-semibold w-14 shrink-0">
                      {format.time(lesson.startsAtUtc)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {lesson.student?.fullName ?? lesson.group?.name ?? '—'}
                    </span>
                    <span className="text-muted-foreground hidden truncate text-sm sm:inline">
                      {lesson.teacher.name}
                    </span>
                    <LessonStatusBadge status={lesson.status} />
                    <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <LessonActionsDialog open={open} onOpenChange={setOpen} lesson={selected} />
    </div>
  );
}
