'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { groupLifecycle, useGroupPrice } from './group-card';
import {
  GroupNextLesson,
  GroupRosterStack,
  GroupSchedulePills,
  GroupStatusBadge,
} from './group-parts';
import { GroupRowActions } from './group-row-actions';

/** Reference layout: group, schedule, students, next lesson, price, actions. */
export const GROUPS_ROW_LAYOUT =
  'minmax(0,2.2fr) minmax(0,2fr) minmax(0,1.5fr) minmax(0,1.7fr) minmax(0,0.7fr) 40px';

function GroupIdentityCell({ group }: { group: GroupListItem }) {
  const t = useTranslations('groups.row');
  const archived = groupLifecycle(group) === 'ARCHIVED';
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-center gap-2">
        <Link
          prefetch={false}
          href={`/app/groups/${group.id}`}
          // The whole row is the target; the name carries the accessible name.
          className="truncate text-[15px] leading-5 font-semibold outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
        >
          {group.name}
        </Link>
        {archived ? <GroupStatusBadge status="ARCHIVED" /> : null}
      </span>
      <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
        {group.teacher?.name ?? t('noTeacher')}
      </span>
    </div>
  );
}

function GroupPriceCell({ group }: { group: GroupListItem }) {
  const price = useGroupPrice(group);
  return price ? (
    <span className="text-sm tabular-nums">{price}</span>
  ) : (
    <span aria-hidden="true" className="text-[13px] text-muted-foreground">
      —
    </span>
  );
}

/** The rows view's columns. Sorting lives in the toolbar. */
export function useGroupsListColumns({
  canArchive,
  onArchive,
  onRestore,
  restoringId,
}: {
  canArchive: boolean;
  onArchive: (group: GroupListItem) => void;
  onRestore: (group: GroupListItem) => void;
  restoringId?: string;
}) {
  const t = useTranslations('groups.columns');

  // The commands come fresh from the page on every render, so the columns do
  // too; a page holds at most 18 rows.
  return useMemo<ColumnDef<GroupListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => t('group'),
        cell: ({ row }) => <GroupIdentityCell group={row.original} />,
      },
      {
        id: 'schedule',
        header: () => t('schedule'),
        cell: ({ row }) => <GroupSchedulePills schedules={row.original.schedules} size="sm" />,
      },
      {
        id: 'students',
        header: () => t('students'),
        cell: ({ row }) => <GroupRosterStack group={row.original} max={4} short />,
      },
      {
        id: 'nextLesson',
        header: () => t('nextLesson'),
        cell: ({ row }) => (
          <GroupNextLesson startsAtUtc={row.original.nextLesson?.startsAtUtc ?? null} />
        ),
      },
      {
        id: 'price',
        header: () => t('price'),
        cell: ({ row }) => <GroupPriceCell group={row.original} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-1 flex justify-end">
            <GroupRowActions
              group={row.original}
              archived={Boolean(row.original.deletedAt)}
              canArchive={canArchive}
              onArchive={() => onArchive(row.original)}
              onRestore={() => onRestore(row.original)}
              busy={restoringId === row.original.id}
            />
          </div>
        ),
      },
    ],
    [t, canArchive, onArchive, onRestore, restoringId],
  );
}
