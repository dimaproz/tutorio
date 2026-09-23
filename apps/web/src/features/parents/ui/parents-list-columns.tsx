'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { ParentListItem } from '@tutorio/validation';
import { ParentRowActions } from './parent-row-actions';
import {
  ParentIdentityCell,
  ParentPhoneCell,
  ParentStudentsCell,
  ParentTelegramCell,
} from './parent-row-cells';

/** Reference layout: parent, phone, Telegram, students, actions. */
export const PARENTS_ROW_LAYOUT =
  'minmax(0,2.2fr) minmax(0,1.35fr) minmax(0,1fr) minmax(0,2.1fr) 40px';

/** The collection table's columns. Only the name sorts, from the toolbar. */
export function useParentsListColumns({
  canDelete,
  onDelete,
  deletingId,
}: {
  canDelete: boolean;
  onDelete: (parent: ParentListItem) => void;
  deletingId?: string;
}) {
  const t = useTranslations('parents');

  return useMemo<ColumnDef<ParentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.parent'),
        cell: ({ row }) => <ParentIdentityCell parent={row.original} />,
      },
      {
        id: 'phone',
        header: () => t('columns.phone'),
        cell: ({ row }) => <ParentPhoneCell phone={row.original.phone} />,
      },
      {
        id: 'telegram',
        header: () => t('columns.telegram'),
        cell: ({ row }) => <ParentTelegramCell username={row.original.telegramUsername} />,
      },
      {
        id: 'students',
        header: () => t('columns.students'),
        cell: ({ row }) => <ParentStudentsCell students={row.original.students} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-1 flex justify-end">
            <ParentRowActions
              parent={row.original}
              canDelete={canDelete}
              onDelete={() => onDelete(row.original)}
              busy={deletingId === row.original.id}
            />
          </div>
        ),
      },
    ],
    [t, canDelete, onDelete, deletingId],
  );
}
