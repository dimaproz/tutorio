'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PencilIcon } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { GroupEnrollmentSummary } from '@tutorio/validation';
import { useLocale, useTranslations } from 'next-intl';
import { DataTable } from '@/components/app/data-table';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { EnrollmentStatusBadge } from '@/components/app/status-badges';
import { Button } from '@/components/ui/button';
import { useLocalSort } from '@/components/app/list-controls';
import { formatMoneyDisplay } from '@/lib/money';

/** Group-specific roster columns, kept separate from the workspace student list. */
export function GroupMembersTable({
  enrollments,
  disabled,
  onEdit,
}: {
  enrollments: GroupEnrollmentSummary[];
  disabled?: boolean;
  onEdit: (enrollment: GroupEnrollmentSummary) => void;
}) {
  const t = useTranslations('groups.detail');
  const locale = useLocale();
  const sort = useLocalSort('student');

  const columns = useMemo<ColumnDef<GroupEnrollmentSummary, unknown>[]>(
    () => [
      {
        id: 'student',
        header: () => t('columns.student'),
        meta: { sortField: 'student' },
        cell: ({ row }) => (
          <Link
            href={`/app/students/${row.original.student.id}`}
            className="flex min-w-44 items-center gap-3 rounded-lg outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <EntityAvatar
              avatarKey={row.original.student.avatarKey}
              fullName={row.original.student.fullName}
              size="sm"
            />
            <span className="truncate font-medium">{row.original.student.fullName}</span>
          </Link>
        ),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
        meta: { sortField: 'status' },
        cell: ({ row }) => <EnrollmentStatusBadge status={row.original.status} />,
      },
      {
        id: 'price',
        header: () => t('columns.price'),
        meta: { sortField: 'price' },
        cell: ({ row }) => (
          <span className="tabular font-medium whitespace-nowrap">
            {formatMoneyDisplay(row.original.priceMinor, row.original.currency, locale)}
          </span>
        ),
      },
      {
        id: 'attendance',
        header: () => t('columns.attendance'),
        cell: () => <span className="text-muted-foreground">{t('attendanceUnavailable')}</span>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onClick={() => onEdit(row.original)}
            >
              <PencilIcon />
              <span className="sr-only">
                {t('editStudent', { name: row.original.student.fullName })}
              </span>
            </Button>
          </div>
        ),
      },
    ],
    [disabled, locale, onEdit, t],
  );

  return (
    <DataTable
      columns={columns}
      data={enrollments}
      caption={t('membersTableCaption')}
      sort={sort}
    />
  );
}
