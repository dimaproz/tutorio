'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon, SendIcon, UsersIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { STUDENT_SUBJECTS, type StudentListItem } from '@tutorio/validation';
import { StudentCard } from './student-card';
import { StudentFormDialog } from './student-form-dialog';
import { StudentRowActions } from './student-row-actions';
import { StudentStatusBadge } from './student-status-badge';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { DataTable } from '@/components/app/data-table';
import {
  ListPagination,
  ListSearchInput,
  ListSelectFilter,
} from '@/components/app/list-controls';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { parsePageParam } from '@/lib/api/filters';
import { useStudentsQuery } from '@/lib/api/students';
import { useGroupsQuery } from '@/lib/api/groups';
import { CURRENCY_META } from '@/components/app/currency-option';
import { formatAmountDisplay } from '@/lib/money';

const STUDENT_STATUSES = ['ACTIVE', 'ON_HOLD', 'ARCHIVED'] as const;

export function StudentsList() {
  const t = useTranslations('students');
  const tSubject = useTranslations('subject');
  const tStatus = useTranslations('studentStatus');
  const tFilters = useTranslations('students.filters');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const status = searchParams.get('status') || undefined;
  const subject = searchParams.get('subject') || undefined;
  const groupId = searchParams.get('groupId') || undefined;

  const students = useStudentsQuery({ page, search, status, subject, groupId });
  const groups = useGroupsQuery({ page: 1, pageSize: 100 });

  const statusOptions = STUDENT_STATUSES.map((value) => ({ value, label: tStatus(value) }));
  const subjectOptions = STUDENT_SUBJECTS.map((value) => ({ value, label: tSubject(value) }));
  const groupOptions = (groups.data?.items ?? []).map((group) => ({
    value: group.id,
    label: group.name,
  }));

  const columns = useMemo<ColumnDef<StudentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.student'),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <EntityAvatar
              avatarKey={row.original.avatarKey}
              fullName={row.original.fullName}
              size="md"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={`/app/students/${row.original.id}`}
                className="truncate font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                {row.original.fullName}
              </Link>
              {row.original.subject ? (
                <span className="truncate text-xs text-muted-foreground">
                  {tSubject(row.original.subject)}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
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
        cell: ({ row }) =>
          row.original.phone ? (
            <a
              href={`tel:${row.original.phone}`}
              className="tabular underline-offset-4 hover:underline"
            >
              {row.original.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">{tCommon('notProvided')}</span>
          ),
      },
      {
        id: 'telegram',
        header: () => t('columns.telegram'),
        cell: ({ row }) => {
          const handle = row.original.telegramUsername?.replace(/^@/, '');
          return handle ? (
            <a
              href={`https://t.me/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
            >
              <SendIcon className="size-3.5" aria-hidden="true" />@{handle}
            </a>
          ) : (
            <span className="text-muted-foreground">{tCommon('notProvided')}</span>
          );
        },
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
    [t, tSubject, tCommon, locale],
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        <ListSelectFilter
          paramKey="status"
          value={status}
          options={statusOptions}
          label={tFilters('statusAll')}
        />
        <ListSelectFilter
          paramKey="subject"
          value={subject}
          options={subjectOptions}
          label={tFilters('subjectAll')}
        />
        <ListSelectFilter
          paramKey="groupId"
          value={groupId}
          options={groupOptions}
          label={tFilters('groupAll')}
        />
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
            <DataTable columns={columns} data={items} caption={t('tableCaption')} />
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
