'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { ContactIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem } from '@tutorio/validation';
import { ParentCard } from './parent-card';
import { ParentFormDialog } from './parent-form-dialog';
import { ParentRowActions } from './parent-row-actions';
import { DataTable } from '@/components/app/data-table';
import {
  PeopleCell,
  PersonCell,
  PhoneCell,
  TelegramCell,
} from '@/components/app/table-cells';
import {
  ListPagination,
  ListSearchInput,
  useUpdateSearchParams,
} from '@/components/app/list-controls';
import { StudentFilterCombobox } from './student-filter-combobox';
import {
  PageHeader,
  QueryErrorAlert,
} from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { CollectionEmptyState, CollectionToolbar, LoadingPanel } from '@/components/shared';
import { parsePageParam } from '@/lib/api/filters';
import { useParentsQuery } from '@/lib/api/parents';

export function ParentsList() {
  const t = useTranslations('parents');
  const tSubject = useTranslations('subject');
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const studentId = searchParams.get('studentId') || undefined;

  const parents = useParentsQuery({ page, search, studentId });

  const columns = useMemo<ColumnDef<ParentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.parent'),
        cell: ({ row }) => (
          <PersonCell
            avatarKey={row.original.avatarKey}
            fullName={row.original.fullName}
            href={`/app/parents/${row.original.id}`}
          />
        ),
      },
      {
        id: 'phone',
        header: () => t('columns.phone'),
        cell: ({ row }) => <PhoneCell phone={row.original.phone} />,
      },
      {
        id: 'telegram',
        header: () => t('columns.telegram'),
        cell: ({ row }) => <TelegramCell username={row.original.telegramUsername} />,
      },
      {
        id: 'students',
        header: () => t('columns.students'),
        cell: ({ row }) => (
          <PeopleCell
            people={row.original.students.map((student) => ({
              id: student.id,
              fullName: student.fullName,
              avatarKey: student.avatarKey,
              subtitle: student.subject ? tSubject(student.subject) : undefined,
            }))}
            hrefFor={(id) => `/app/students/${id}`}
          />
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ParentRowActions
              parentId={row.original.id}
              fullName={row.original.fullName}
              showOpenLink={false}
            />
          </div>
        ),
      },
    ],
    [t, tSubject],
  );

  const items = parents.data?.items ?? [];
  const showEmpty = parents.isSuccess && items.length === 0;

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
        <StudentFilterCombobox
          value={studentId}
          onChange={(next) => updateParams({ studentId: next }, { resetPage: true })}
        />
      </CollectionToolbar>

      {parents.isPending ? <LoadingPanel size="lg" /> : null}

      {parents.isError ? (
        <QueryErrorAlert
          error={parents.error}
          title={t('error.title')}
          onRetry={() => void parents.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <ParentsEmptyState search={search} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((parent) => (
              <ParentCard key={parent.id} parent={parent} />
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={items}
              caption={t('tableCaption')}
              loading={parents.isFetching}
            />
          </div>
          <ListPagination page={page} totalPages={parents.data?.totalPages ?? 1} />
        </>
      ) : null}

      <ParentFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ParentsEmptyState({ search, onCreate }: { search?: string; onCreate: () => void }) {
  const t = useTranslations('parents');
  const scope = search ? 'emptySearch' : 'empty';

  return (
    <CollectionEmptyState
      icon={ContactIcon}
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
