'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useLocale, useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { DataTable } from '@/components/app/data-table';
import { useLocalSort } from '@/components/app/list-controls';
import { LessonStatusBadge } from '@/components/app/status-badges';
import { Badge } from '@/components/ui/badge';
import { lessonKind, sortLessons } from '@/features/scheduling/model/lesson-table';
import { useDateFormatters } from '@/lib/i18n/format';
import { formatMoneyDisplay } from '@/lib/money';
import type { LessonDialogMode } from './lesson-actions-dialog';
import { LessonRowActions } from './lesson-row-actions';

/**
 * A student's lessons as a sortable table. The rows are already in memory, so
 * the ordering is done here rather than asked of the server.
 */
export function LessonsTable({
  lessons,
  emptyMessage,
  loading = false,
  onOpenDialog,
}: {
  lessons: LessonResponse[];
  emptyMessage: string;
  /** True while the lesson list refetches — e.g. right after a row action. */
  loading?: boolean;
  onOpenDialog: (lesson: LessonResponse, mode: LessonDialogMode) => void;
}) {
  const t = useTranslations('scheduling.studentLessons');
  const tKind = useTranslations('scheduling.lessonKind');
  const locale = useLocale();
  const format = useDateFormatters();
  const sort = useLocalSort('startsAtUtc');

  const columns = useMemo<ColumnDef<LessonResponse, unknown>[]>(
    () => [
      {
        id: 'startsAtUtc',
        header: () => t('columns.datetime'),
        meta: { sortField: 'startsAtUtc' },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => onOpenDialog(row.original, 'menu')}
            className="tabular font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {format.dayMonthTime(row.original.startsAtUtc)}
          </button>
        ),
      },
      {
        id: 'durationMin',
        header: () => t('columns.duration'),
        meta: { sortField: 'durationMin' },
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground">
            {t('durationMinutes', { minutes: row.original.durationMin })}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
        meta: { sortField: 'status' },
        cell: ({ row }) => <LessonStatusBadge status={row.original.status} />,
      },
      {
        id: 'kind',
        header: () => t('columns.kind'),
        meta: { sortField: 'kind' },
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.group?.name ?? tKind(lessonKind(row.original))}
          </Badge>
        ),
      },
      {
        id: 'priceMinor',
        header: () => t('columns.price'),
        meta: { sortField: 'priceMinor' },
        cell: ({ row }) => (
          <span className="tabular font-medium whitespace-nowrap">
            {formatMoneyDisplay(row.original.priceMinor, row.original.currency, locale)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <LessonRowActions lesson={row.original} onOpenDialog={onOpenDialog} />
          </div>
        ),
      },
    ],
    [t, tKind, locale, format, onOpenDialog],
  );

  const rows = useMemo(
    () => sortLessons(lessons, sort.field, sort.order),
    [lessons, sort.field, sort.order],
  );

  if (rows.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      caption={t('tableCaption')}
      sort={sort}
      loading={loading}
    />
  );
}
