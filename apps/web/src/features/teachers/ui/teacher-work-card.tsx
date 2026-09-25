'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, LayersIcon, PlusIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GroupListItem, ScheduleResponse } from '@tutorio/validation';
import { EmptyState } from '@/components/shared/empty-state';
import { IconButton } from '@/components/shared/icon-button';
import { Segmented } from '@/components/shared/segmented';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from '@/features/groups';
import { useIsMobile } from '@/hooks/use-mobile';
import { TeacherScheduleRow } from './teacher-schedule-row';

type Tab = 'groups' | 'schedules';

export type WorkList<T> = {
  items: T[];
  total: number;
  loading: boolean;
};

/**
 * The teacher's groups and schedules in one card with tabs (S09 decision 4),
 * groups first: the real `GroupCard`s two a row on paper, and the schedule
 * rows in a scroll region with «Показати ще» into the same box. The tab's
 * «+» is on the right. On a phone the groups stand on the page, outside the
 * card, and «+» is an icon button.
 */
export function TeacherWorkCard({
  teacherId,
  groups,
  schedules,
  now,
  onMoreSchedules,
  moreStep,
  onNewSchedule,
  onChangeSchedule,
  onStopSchedule,
}: {
  teacherId: string;
  groups: WorkList<GroupListItem>;
  schedules: WorkList<ScheduleResponse>;
  now: number;
  onMoreSchedules: () => void;
  /** How many more rows «Показати ще» brings. */
  moreStep: number;
  /** The S05 schedule form for this teacher; omitted on an archived profile. */
  onNewSchedule?: () => void;
  onChangeSchedule?: (schedule: ScheduleResponse) => void;
  onStopSchedule?: (schedule: ScheduleResponse) => void;
}) {
  const t = useTranslations('teachers.profile.work');
  const mobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('groups');
  const editable = Boolean(onNewSchedule);
  const newGroupHref = `/app/groups/new?teacherId=${teacherId}`;

  const add =
    tab === 'groups' ? (
      mobile ? (
        <Button asChild variant="outline" size="icon-sm" className="rounded-pill">
          <Link href={newGroupHref} aria-label={t('newGroup')}>
            <PlusIcon />
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={newGroupHref}>
            <PlusIcon data-icon="inline-start" />
            {t('newGroup')}
          </Link>
        </Button>
      )
    ) : mobile ? (
      <IconButton
        icon={<PlusIcon />}
        label={t('newSchedule')}
        size={36}
        border
        onClick={onNewSchedule}
      />
    ) : (
      <Button type="button" variant="outline" size="sm" onClick={onNewSchedule}>
        <PlusIcon data-icon="inline-start" />
        {t('newSchedule')}
      </Button>
    );

  const header = (
    <div className="flex items-center justify-between gap-3">
      <Segmented
        label={t('label')}
        variant="paper"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'groups', label: t('groups'), count: groups.loading ? undefined : groups.total },
          {
            value: 'schedules',
            label: t('schedules'),
            count: schedules.loading ? undefined : schedules.total,
          },
        ]}
      />
      {editable ? add : null}
    </div>
  );

  const groupCards = groups.loading ? (
    <Skeleton className="h-56 w-full rounded-card" />
  ) : groups.items.length === 0 ? (
    <EmptyState
      framed
      icon={<LayersIcon />}
      title={t('groupsEmpty')}
      text={t('groupsEmptyText')}
      minHeight={180}
    />
  ) : (
    <ul className="grid gap-3 lg:grid-cols-2">
      {groups.items.map((group) => (
        <li key={group.id} className="flex *:grow">
          <GroupCard group={group} ground={mobile ? 'card' : 'paper'} />
        </li>
      ))}
    </ul>
  );

  const shown = schedules.items.length;
  const scheduleList = schedules.loading ? (
    <Skeleton className="h-56 w-full rounded-card" />
  ) : shown === 0 ? (
    <EmptyState
      framed
      icon={<RepeatIcon />}
      title={t('schedulesEmpty')}
      text={t('schedulesEmptyText')}
      minHeight={180}
    />
  ) : (
    <div className="flex flex-col gap-3">
      <ul className="scrollbar-thin max-h-75 overflow-y-auto pr-1">
        {schedules.items.map((schedule) => (
          <TeacherScheduleRow
            key={schedule.id}
            schedule={schedule}
            now={now}
            onChange={onChangeSchedule ? () => onChangeSchedule(schedule) : undefined}
            onStop={onStopSchedule ? () => onStopSchedule(schedule) : undefined}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>{t('showing', { shown, total: schedules.total })}</span>
        {schedules.total > shown ? (
          <Button type="button" variant="ghost" size="sm" onClick={onMoreSchedules}>
            <ChevronDownIcon data-icon="inline-start" />
            {t('more', { count: Math.min(schedules.total - shown, moreStep) })}
          </Button>
        ) : null}
      </div>
    </div>
  );

  // Phones lay the group cards on the page itself, without the wrapper card.
  if (mobile && tab === 'groups') {
    return (
      <section aria-label={t('label')} className="flex flex-col gap-3">
        {header}
        {groupCards}
      </section>
    );
  }

  return (
    <Card role="region" aria-label={t('label')} className="gap-4 px-4 py-4.5 md:px-5">
      {header}
      {tab === 'groups' ? groupCards : scheduleList}
    </Card>
  );
}
