'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { TeacherCell } from '@/features/lesson-list';
import { NextCell, SlotsCell, StatusCell, WhoCell, type ListSchedule } from './schedule-cells';
import { ScheduleRowMenu, type ScheduleAction } from './schedule-row-menu';

/** Who, teacher, days and time, state, next; solo drops the teacher. */
export function schedulesRowLayout(solo: boolean) {
  return solo
    ? 'minmax(0,1.5fr) minmax(0,1.4fr) minmax(0,1.3fr) minmax(0,1.3fr) 36px'
    : 'minmax(0,1.35fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.1fr) minmax(0,1.2fr) 36px';
}

/** The Schedules table's columns (S05 decision 2). */
export function useSchedulesColumns({
  solo,
  now,
  teacherAvatars,
  onAction,
}: {
  solo: boolean;
  now: number;
  teacherAvatars: Map<string, string | null>;
  onAction: (action: ScheduleAction, schedule: ListSchedule) => void;
}) {
  const t = useTranslations('schedules.list.columns');
  return useMemo<ColumnDef<ListSchedule, unknown>[]>(
    () => [
      {
        id: 'who',
        header: () => t('who'),
        cell: ({ row }) => <WhoCell schedule={row.original} />,
      },
      ...(solo
        ? []
        : [
            {
              id: 'teacher',
              header: () => t('teacher'),
              cell: ({ row }) => (
                <TeacherCell
                  name={row.original.teacher.name}
                  avatarKey={teacherAvatars.get(row.original.teacher.id)}
                />
              ),
            } satisfies ColumnDef<ListSchedule, unknown>,
          ]),
      {
        id: 'slots',
        header: () => t('slots'),
        cell: ({ row }) => <SlotsCell schedule={row.original} />,
      },
      {
        id: 'status',
        header: () => t('status'),
        cell: ({ row }) => <StatusCell schedule={row.original} />,
      },
      {
        id: 'next',
        header: () => t('next'),
        cell: ({ row }) => <NextCell schedule={row.original} now={now} />,
      },
      {
        id: 'menu',
        header: () => <span className="sr-only">{t('actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ScheduleRowMenu schedule={row.original} onAction={onAction} />
          </div>
        ),
      },
    ],
    [now, onAction, solo, t, teacherAvatars],
  );
}
