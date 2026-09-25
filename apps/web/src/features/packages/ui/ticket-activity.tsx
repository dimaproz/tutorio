'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CalendarPlusIcon,
  CirclePauseIcon,
  PackageIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CreditEntryResponse } from '@tutorio/validation';
import { EmptyState } from '@/components/shared/empty-state';
import { LessonList } from '@/components/shared/lesson-list';
import { LessonTimeline, type TimelineItem } from '@/components/shared/lesson-timeline';
import { Segmented } from '@/components/shared/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { LessonStatusBadge } from '@/features/lessons';
import type { HistoryEvent } from '../model/ticket';
import type { PackageFormat } from './use-package-format';

type Lesson = NonNullable<CreditEntryResponse['lesson']>;
type View = 'lessons' | 'history';

/**
 * The ticket's lower half (board 02): «Заняття · N» — the lessons the
 * package paid for, newest first, each with what it cost («списано 1», a
 * late cancellation) and its status — and «Історія», everything else that
 * happened to it.
 */
export function TicketActivity({
  lessons,
  history,
  title,
  currency,
  loading,
  mobile,
  format,
}: {
  lessons: Lesson[];
  history: HistoryEvent[];
  currency: string;
  /** What every lesson row is called: the direction. */
  title: string;
  loading: boolean;
  mobile: boolean;
  format: PackageFormat;
}) {
  const t = useTranslations('packages.ticket');
  const [view, setView] = useState<View>('lessons');

  const rows = lessons.map((lesson) => {
    const tile = format.tile(lesson.startsAt);
    const end = new Date(Date.parse(lesson.startsAt) + lesson.durationMin * 60_000);
    const times = `${format.time(lesson.startsAt)} – ${format.time(end)}`;
    const cost =
      lesson.status === 'CANCELLED_CHARGED'
        ? t('lessonLate')
        : lesson.status === 'NO_SHOW'
          ? t('lessonNoShow')
          : t('lessonCharged');
    return {
      id: lesson.id,
      weekday: tile.top,
      day: tile.day,
      title,
      meta: `${format.month(lesson.startsAt)} · ${times} · ${cost}`,
      metaShort: `${times} · ${cost}`,
      status: <LessonStatusBadge status={lesson.status} />,
    };
  });

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-18 w-full rounded-row" />
        ))}
      </div>
    );
  } else if (view === 'lessons') {
    body =
      rows.length === 0 ? (
        <p className="rounded-row bg-background px-5 py-4.5 text-sm text-muted-foreground">
          {t('lessonsEmpty')}
        </p>
      ) : (
        <LessonList
          framed={false}
          compact={mobile}
          maxHeight={mobile ? 520 : 420}
          groups={[{ label: '', items: rows }]}
          shown={rows.length}
          total={rows.length}
          regionLabel={t('tabs.lessons')}
        />
      );
  } else {
    body =
      history.length === 0 ? (
        <EmptyState title={t('history.empty')} minHeight={120} />
      ) : (
        <HistoryTimeline events={history} currency={currency} format={format} />
      );
  }

  return (
    <section aria-label={t('tabs.label')} className="flex flex-col gap-3">
      <Segmented
        label={t('tabs.label')}
        value={view}
        onValueChange={setView}
        className="w-fit"
        items={[
          {
            value: 'lessons',
            label:
              rows.length > 0 ? t('tabs.lessonsCount', { count: rows.length }) : t('tabs.lessons'),
          },
          { value: 'history', label: t('tabs.history') },
        ]}
      />
      {body}
    </section>
  );
}

const HISTORY_ICON: Record<HistoryEvent['kind'], ReactNode> = {
  purchase: <PackageIcon />,
  adjustment: <SlidersHorizontalIcon />,
  transferOut: <ArrowRightIcon />,
  transferIn: <ArrowLeftIcon />,
  refundCredits: <RotateCcwIcon />,
  payment: <BanknoteIcon />,
  refund: <RotateCcwIcon />,
  pause: <CirclePauseIcon />,
  extend: <CalendarPlusIcon />,
};

const HISTORY_TONE: Record<HistoryEvent['kind'], TimelineItem['tone']> = {
  purchase: 'indigo',
  adjustment: 'plain',
  transferOut: 'plain',
  transferIn: 'indigo',
  refundCredits: 'danger',
  payment: 'success',
  refund: 'danger',
  pause: 'system',
  extend: 'indigo',
};

function HistoryTimeline({
  events,
  currency,
  format,
}: {
  events: HistoryEvent[];
  currency: string;
  format: PackageFormat;
}) {
  const t = useTranslations('packages.ticket.history');
  const tMethod = useTranslations('packages.methods');
  const items: TimelineItem[] = events.map((event) => {
    const base = {
      id: event.id,
      icon: HISTORY_ICON[event.kind],
      tone: HISTORY_TONE[event.kind],
      time: format.shortDay(event.at),
    };
    switch (event.kind) {
      case 'purchase':
        return { ...base, title: t('purchase', { count: event.credits }) };
      case 'adjustment':
        return {
          ...base,
          title: t('adjustment', {
            delta: event.credits > 0 ? `+${event.credits}` : event.credits,
          }),
          meta: event.note ?? undefined,
        };
      case 'transferOut':
        return { ...base, title: t('transferOut', { count: event.credits }) };
      case 'transferIn':
        return { ...base, title: t('transferIn', { count: event.credits }) };
      case 'refundCredits':
        return {
          ...base,
          title: t('refundCredits', { count: event.credits }),
          meta: event.note ?? undefined,
        };
      case 'payment':
      case 'refund':
        return {
          ...base,
          title: t(event.kind, { amount: format.money(event.amountMinor, currency) }),
          meta: tMethod(event.method),
        };
      case 'extend':
        return {
          ...base,
          title: t('extend', { date: format.dayMonth(new Date(Date.parse(event.to) - 1)) }),
          meta: event.from
            ? t('extendFrom', { date: format.dayMonth(new Date(Date.parse(event.from) - 1)) })
            : undefined,
        };
      case 'pause':
        return {
          ...base,
          title: t('pause', { days: event.days }),
          meta: event.to
            ? format.dayRange(event.from, new Date(Date.parse(event.to) - 1))
            : format.dayMonth(event.from),
        };
    }
  });
  return (
    <LessonTimeline
      items={items}
      visible={6}
      showAllLabel={(hidden) => t('showAll', { count: hidden })}
      collapseLabel={t('collapse')}
      label={t('label')}
    />
  );
}
