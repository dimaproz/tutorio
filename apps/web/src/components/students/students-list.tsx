'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { StudentCard } from './student-card';
import { StudentFormDialog } from './student-form-dialog';
import { StudentRowActions } from './student-row-actions';
import { StudentsListSkeleton } from './students-list-skeleton';
import { StudentStatusBadge } from '@/components/app/status-badges';
import { STUDENT_STATUS_META } from '@/components/app/status-meta';
import { DataTable } from '@/components/app/data-table';
import { PersonCell, PhoneCell, TelegramCell } from '@/components/app/table-cells';
import {
  ListPagination,
  ListSearchInput,
  ListSelectFilter,
  useListSort,
} from '@/components/app/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { CollectionEmptyState, CollectionToolbar } from '@/components/shared';
import { parsePageParam } from '@/lib/api/filters';
import { useStudentsQuery } from '@/lib/api/students';
import { useGroupsQuery } from '@/lib/api/groups';
import { CURRENCY_META } from '@/components/app/currency-option';
import { formatAmountDisplay } from '@/lib/money';

const STUDENT_STATUSES = ['ACTIVE', 'ON_HOLD', 'ARCHIVED'] as const;

export function StudentsList() {
  const t = useTranslations('students');
  const tStatus = useTranslations('studentStatus');
  const tFilters = useTranslations('students.filters');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const status = searchParams.get('status') || undefined;
  const groupId = searchParams.get('groupId') || undefined;

  // `fullName` matches the API default, so an unsorted URL stays clean.
  const sort = useListSort('fullName');
  const students = useStudentsQuery({
    page,
    search,
    status,
    groupId,
    sort: sort.field,
    order: sort.order,
  });
  const groups = useGroupsQuery({ page: 1, pageSize: 100 });

  const statusOptions = STUDENT_STATUSES.map((value) => ({
    value,
    label: tStatus(value),
    ...STUDENT_STATUS_META[value],
  }));
  const groupOptions = (groups.data?.items ?? []).map((group) => ({
    value: group.id,
    label: group.name,
  }));

  const columns = useMemo<ColumnDef<StudentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.student'),
        meta: { sortField: 'fullName' },
        cell: ({ row }) => (
          <PersonCell
            avatarKey={row.original.avatarKey}
            fullName={row.original.fullName}
            href={`/app/students/${row.original.id}`}
          />
        ),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
        meta: { sortField: 'status' },
        cell: ({ row }) => <StudentStatusBadge status={row.original.status} />,
      },
      {
        id: 'group',
        header: () => t('columns.group'),
        cell: ({ row }) =>
          row.original.groupNames.length > 0 ? (
            <span>{row.original.groupNames.join(', ')}</span>
          ) : (
            <span className="text-muted-foreground">{t('individual')}</span>
          ),
      },
      {
        id: 'price',
        header: () => t('columns.price'),
        meta: { sortField: 'hourlyRateMinor' },
        cell: ({ row }) =>
          row.original.hourlyRateMinor != null && row.original.currency ? (
            <span className="tabular font-medium whitespace-nowrap">
              {formatAmountDisplay(row.original.hourlyRateMinor, locale)}{' '}
              <span className="text-muted-foreground">
                {CURRENCY_META[row.original.currency]?.symbol ?? row.original.currency}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{tCommon('notProvided')}</span>
          ),
      },
      {
        id: 'phone',
        header: () => t('columns.phone'),
        meta: { sortField: 'phone' },
        cell: ({ row }) => <PhoneCell phone={row.original.phone} />,
      },
      {
        id: 'telegram',
        header: () => t('columns.telegram'),
        meta: { sortField: 'telegramUsername' },
        cell: ({ row }) => <TelegramCell username={row.original.telegramUsername} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <StudentRowActions
              studentId={row.original.id}
              fullName={row.original.fullName}
              avatarKey={row.original.avatarKey}
              status={row.original.status}
            />
          </div>
        ),
      },
    ],
    [t, tCommon, locale],
  );

  const items = students.data?.items ?? [];
  const showEmpty = students.isSuccess && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button className="h-11 md:h-9" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon />
            {t('add')}
          </Button>
        }
      />

      <CollectionToolbar>
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        <ListSelectFilter
          paramKey="status"
          value={status}
          options={statusOptions}
          label={tFilters('statusAll')}
        />
        <ListSelectFilter
          paramKey="groupId"
          value={groupId}
          options={groupOptions}
          label={tFilters('groupAll')}
        />
      </CollectionToolbar>

      {students.isPending ? (
        <StudentsListSkeleton caption={t('tableCaption')} loadingLabel={tCommon('loading')} />
      ) : null}

      {students.isError ? (
        <QueryErrorAlert
          error={students.error}
          title={t('error.title')}
          onRetry={() => void students.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <StudentsEmptyState search={search} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {items.length > 0 ? (
        <>
          {/* Mobile: cards. Desktop: an accessible table — the mobile layout
              never depends on horizontally scrolling a desktop table. */}
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={items}
              caption={t('tableCaption')}
              sort={sort}
              loading={students.isFetching}
            />
          </div>
          <ListPagination page={page} totalPages={students.data?.totalPages ?? 1} />
        </>
      ) : null}

      <StudentFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function StudentsEmptyState({ search, onCreate }: { search?: string; onCreate: () => void }) {
  const t = useTranslations('students');
  const scope = search ? 'emptySearch' : 'empty';

  return (
    <CollectionEmptyState
      icon={UsersIcon}
      title={t(`${scope}.title`)}
      description={t(`${scope}.description`)}
      action={
        scope === 'empty' ? (
          <Button onClick={onCreate}>
            <PlusIcon data-icon />
            {t('empty.action')}
          </Button>
        ) : undefined
      }
    />
  );
}
