'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { AvatarStack, WhoSearch, type WhoSearchItem } from '@/components/shared/who-picker';
import {
  useCurrentPausesQuery,
  useGroupsQuery,
  usePackagesQuery,
  useStudentsQuery,
} from '../../api';
import { useSlotsLabel } from '../field-labels';

/** The student search in the band: the studio's students with their package or pause. */
export function StudentSearch({
  onPick,
  onClose,
  mobile,
}: {
  onPick: (studentId: string) => void;
  onClose: () => void;
  mobile: boolean;
}) {
  const t = useTranslations('lessons.create');
  const format = useFormatter();
  const [query, setQuery] = useState('');
  const students = useStudentsQuery({
    page: 1,
    pageSize: 20,
    search: query.trim() || undefined,
    state: 'active',
    sort: 'fullName',
  });
  const packages = usePackagesQuery({ page: 1, pageSize: 100, state: 'active' });
  const pauses = useCurrentPausesQuery();
  const [now] = useState(() => Date.now());

  const items: WhoSearchItem[] = (students.data?.items ?? []).map((student) => {
    const pkg = (packages.data?.items ?? [])
      .filter(
        (item) =>
          item.studentId === student.id &&
          item.groupId === null &&
          item.remainingCredits > 0 &&
          (item.expiresAt === null || Date.parse(item.expiresAt) > now),
      )
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
    const pause = pauses.data?.items.find(
      (item) => item.studentId === student.id && item.enrollmentId === null,
    );
    const paused = Boolean(pause) || student.status === 'ON_HOLD';
    const trail = paused ? (
      <Badge variant="warning" dot>
        {pause?.endsAt
          ? t('badgePaused', {
              date: format.dateTime(new Date(pause.endsAt), { day: 'numeric', month: 'short' }),
            })
          : t('badgePausedOpen')}
      </Badge>
    ) : pkg ? (
      <Badge
        variant={pkg.remainingCredits <= 2 ? 'warning' : 'neutral'}
        dot={pkg.remainingCredits <= 2}
      >
        {t('badgePackage', { left: pkg.remainingCredits, total: pkg.lessonsTotal })}
      </Badge>
    ) : undefined;
    return {
      value: student.id,
      title: student.fullName,
      subtitle:
        student.phone ??
        (student.telegramUsername ? `@${student.telegramUsername}` : (student.email ?? undefined)),
      media: <EntityAvatar avatarKey={student.avatarKey} fullName={student.fullName} size="sm" />,
      trail,
      muted: paused,
    };
  });

  const newStudent = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="w-full justify-start font-semibold text-brand hover:text-brand"
    >
      <Link prefetch={false} href="/app/students/new">
        <PlusIcon data-icon="inline-start" />
        {items.length === 0 && query.trim()
          ? t('newStudentNamed', { name: query.trim() })
          : t('newStudent')}
      </Link>
    </Button>
  );

  return (
    <WhoSearch
      query={query}
      onQueryChange={setQuery}
      items={items}
      loading={students.isPending}
      compact={mobile}
      onSelect={onPick}
      onClose={onClose}
      footer={newStudent}
      labels={{
        placeholder: t('searchStudent'),
        heading: query.trim() ? t('headingFound') : t('headingStudents'),
        clear: t('clear'),
        close: t('closeSearch'),
        escape: t('escape'),
        emptyTitle: t('emptyTitle', { query: query.trim() }),
        emptyText: t('emptyText'),
      }}
    />
  );
}

/** The group search in the band: each group with its members, schedule and size. */
export function GroupSearch({
  onPick,
  onClose,
}: {
  onPick: (groupId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('lessons.create');
  const slots = useSlotsLabel();
  const [query, setQuery] = useState('');
  const groups = useGroupsQuery({ page: 1, pageSize: 20, search: query.trim() || undefined });
  const items: WhoSearchItem[] = (groups.data?.items ?? []).map((group) => {
    const schedule = slots(
      group.schedules.flatMap((item) =>
        item.weekdays.map((weekday) => ({ weekday, localTime: item.localTime })),
      ),
    );
    return {
      value: group.id,
      title: group.name,
      subtitle: schedule
        ? t('groupRow', { schedule, count: group.activeStudentCount })
        : t('groupRowNoSchedule', { count: group.activeStudentCount }),
      media: <AvatarStack people={group.students} max={3} size="xs" />,
    };
  });
  return (
    <WhoSearch
      query={query}
      onQueryChange={setQuery}
      items={items}
      loading={groups.isPending}
      onSelect={onPick}
      onClose={onClose}
      footer={
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full justify-start font-semibold text-brand hover:text-brand"
        >
          <Link prefetch={false} href="/app/groups/new">
            <PlusIcon data-icon="inline-start" />
            {t('newGroup')}
          </Link>
        </Button>
      }
      labels={{
        placeholder: t('searchGroup'),
        heading: t('headingGroups'),
        clear: t('clear'),
        close: t('closeSearch'),
        escape: t('escape'),
        emptyTitle: t('emptyGroupTitle', { query: query.trim() }),
      }}
    />
  );
}
