'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { StudentCard } from './student-card';
import { StudentFormDialog } from './student-form-dialog';
import { StudentRowActions } from './student-row-actions';
import { DataTable } from '@/components/app/data-table';
import {
  ListPagination,
  ListSearchInput,
  ListStateFilter,
} from '@/components/app/list-controls';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import { DeletedBadge } from '@/components/app/status-badges';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { parsePageParam, parseStateParam } from '@/lib/api/filters';
import { useStudentsQuery } from '@/lib/api/students';

export function StudentsList() {
  const t = useTranslations('students');
  const searchParams = useSearchParams();
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const state = parseStateParam(searchParams.get('state'), isOwner);

  const students = useStudentsQuery({ page, search, state });

  const columns = useMemo<ColumnDef<StudentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.student'),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-1">
            {row.original.deletedAt ? (
              <span className="truncate font-medium">{row.original.fullName}</span>
            ) : (
              <Link
                href={`/app/students/${row.original.id}`}
                className="truncate font-medium underline-offset-4 hover:underline"
              >
                {row.original.fullName}
              </Link>
            )}
            {row.original.deletedAt ? <DeletedBadge label={t('deletedBadge')} /> : null}
          </div>
        ),
      },
      {
        id: 'contacts',
        header: () => t('columns.contacts'),
        cell: ({ row }) => <ContactSummary email={row.original.email} phone={row.original.phone} />,
      },
      {
        id: 'groups',
        header: () => t('columns.groups'),
        cell: ({ row }) =>
          row.original.groupNames.length > 0 ? (
            <span>{row.original.groupNames.join(', ')}</span>
          ) : (
            <span className="text-muted-foreground">{t('noGroups')}</span>
          ),
      },
      {
        id: 'enrollments',
        header: () => t('columns.enrollments'),
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground">
            {t('activeEnrollments', { count: row.original.activeEnrollmentCount })}
          </span>
        ),
      },
      {
        accessorKey: 'timezone',
        header: () => t('columns.timezone'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.timezone}</span>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <StudentRowActions
              studentId={row.original.id}
              fullName={row.original.fullName}
              isDeleted={Boolean(row.original.deletedAt)}
            />
          </div>
        ),
      },
    ],
    [t],
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        {isOwner ? <ListStateFilter value={state} /> : null}
      </div>

      {students.isPending ? <ListSkeleton /> : null}

      {students.isError ? (
        <QueryErrorAlert
          error={students.error}
          title={t('error.title')}
          onRetry={() => void students.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <StudentsEmptyState search={search} state={state} onCreate={() => setCreateOpen(true)} />
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
            <DataTable columns={columns} data={items} caption={t('tableCaption')} />
          </div>
          <ListPagination page={page} totalPages={students.data?.totalPages ?? 1} />
        </>
      ) : null}

      <StudentFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ContactSummary({ email, phone }: { email: string | null; phone: string | null }) {
  const tCommon = useTranslations('common');
  if (!email && !phone) {
    return <span className="text-muted-foreground">{tCommon('notProvided')}</span>;
  }
  return (
    <div className="flex flex-col text-sm">
      {email ? <span>{email}</span> : null}
      {phone ? <span className="text-muted-foreground">{phone}</span> : null}
    </div>
  );
}

function StudentsEmptyState({
  search,
  state,
  onCreate,
}: {
  search?: string;
  state: 'active' | 'deleted' | 'all';
  onCreate: () => void;
}) {
  const t = useTranslations('students');
  const scope = search ? 'emptySearch' : state === 'deleted' ? 'emptyDeleted' : 'empty';

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersIcon />
        </EmptyMedia>
        <EmptyTitle>{t(`${scope}.title`)}</EmptyTitle>
        <EmptyDescription>{t(`${scope}.description`)}</EmptyDescription>
      </EmptyHeader>
      {scope === 'empty' ? (
        <EmptyContent>
          <Button onClick={onCreate}>
            <PlusIcon data-icon />
            {t('empty.action')}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
