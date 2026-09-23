'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import type { StudentRollup } from '@/features/students/model/rollups';
import { StudentRowActions } from './student-row-actions';
import {
  StudentBalanceCell,
  StudentCreditsCell,
  StudentIdentityCell,
  StudentLearningCell,
  StudentNextLessonCell,
  type PackagesReadState,
} from './student-row-cells';

/** Reference layout: student, learning, credits, next lesson, balance, actions. */
export const STUDENTS_ROW_LAYOUT =
  'minmax(0,2.3fr) minmax(0,1.5fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1fr) 40px';

/** The collection table's columns, fed by the page's rollups and package read. */
export function useStudentsListColumns({
  rollups,
  packagesState,
  now,
}: {
  rollups: Map<string, StudentRollup>;
  packagesState: PackagesReadState;
  now: number;
}) {
  const t = useTranslations('students');

  return useMemo<ColumnDef<StudentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.student'),
        meta: { sortField: 'fullName' },
        cell: ({ row }) => <StudentIdentityCell student={row.original} />,
      },
      {
        id: 'learning',
        header: () => t('columns.learning'),
        cell: ({ row }) => (
          <StudentLearningCell
            student={row.original}
            teacher={rollups.get(row.original.id)?.teacherName}
          />
        ),
      },
      {
        id: 'credits',
        header: () => t('columns.credits'),
        cell: ({ row }) => (
          <StudentCreditsCell
            credits={rollups.get(row.original.id)?.credits}
            packages={packagesState}
          />
        ),
      },
      {
        id: 'nextLesson',
        header: () => t('columns.nextLesson'),
        cell: ({ row }) => (
          <StudentNextLessonCell
            status={row.original.status}
            next={rollups.get(row.original.id)?.next}
            now={now}
          />
        ),
      },
      {
        id: 'balance',
        header: () => t('columns.balance'),
        cell: ({ row }) => (
          <StudentBalanceCell
            balance={rollups.get(row.original.id)?.balance}
            status={row.original.status}
            packages={packagesState}
          />
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-1 flex justify-end">
            <StudentRowActions
              studentId={row.original.id}
              fullName={row.original.fullName}
              status={row.original.status}
            />
          </div>
        ),
      },
    ],
    [t, rollups, packagesState, now],
  );
}
