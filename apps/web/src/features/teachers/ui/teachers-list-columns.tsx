'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { TeacherListItem } from '@tutorio/validation';
import { TeacherIdentity, TeacherSubjectChips, useTeacherRate } from './teacher-parts';
import { TeacherRowActions, type TeacherCommands } from './teacher-row-actions';

/** Reference layout: teacher, subjects, students, groups, this week, rate, actions. */
export const TEACHERS_ROW_LAYOUT =
  'minmax(0,2.6fr) minmax(0,2fr) minmax(0,0.6fr) minmax(0,0.7fr) minmax(0,0.9fr) minmax(0,0.9fr) 44px';

function RightHeader({ label }: { label: string }) {
  return <span className="block text-right">{label}</span>;
}

function Figure({ value }: { value: number }) {
  return <span className="block text-right text-[15px] font-semibold tabular-nums">{value}</span>;
}

function WeekCell({ teacher }: { teacher: TeacherListItem }) {
  const t = useTranslations('teachers');
  return (
    <span className="block text-right text-[13px] text-muted-foreground">
      <span className="text-[15px] font-semibold text-foreground tabular-nums">
        {teacher.week.lessonCount}
      </span>{' '}
      {t('lessonsShort')}
    </span>
  );
}

function RateCell({ teacher }: { teacher: TeacherListItem }) {
  const t = useTranslations('teachers');
  const rate = useTeacherRate()(teacher);
  return (
    <span className="block text-right font-mono text-sm tabular-nums">
      {rate?.text ?? <span className="text-muted-foreground">{t('noRate')}</span>}
    </span>
  );
}

/** The table view's columns. Sorting lives in the toolbar. */
export function useTeachersListColumns(commands: TeacherCommands) {
  const t = useTranslations('teachers.columns');

  // The commands come fresh from the page on every render, so the columns do too.
  return useMemo<ColumnDef<TeacherListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('teacher'),
        cell: ({ row }) => <TeacherIdentity teacher={row.original} />,
      },
      {
        id: 'subjects',
        header: () => t('subjects'),
        cell: ({ row }) => <TeacherSubjectChips subjects={row.original.subjects} />,
      },
      {
        id: 'students',
        header: () => <RightHeader label={t('students')} />,
        cell: ({ row }) => <Figure value={row.original.studentCount} />,
      },
      {
        id: 'groups',
        header: () => <RightHeader label={t('groups')} />,
        cell: ({ row }) => <Figure value={row.original.groupCount} />,
      },
      {
        id: 'week',
        header: () => <RightHeader label={t('week')} />,
        cell: ({ row }) => <WeekCell teacher={row.original} />,
      },
      {
        id: 'rate',
        header: () => <RightHeader label={t('rate')} />,
        cell: ({ row }) => <RateCell teacher={row.original} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-1 flex justify-end">
            <TeacherRowActions teacher={row.original} commands={commands} />
          </div>
        ),
      },
    ],
    [t, commands],
  );
}
