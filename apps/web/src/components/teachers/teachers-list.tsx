'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon, PresentationIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeacherListItem } from '@tutorio/validation';
import { TeacherCard } from './teacher-card';
import { TeacherFormDialog } from './teacher-form-dialog';
import { TeacherRowActions } from './teacher-row-actions';
import { DataTable } from '@/components/app/data-table';
import { ListPagination, ListSearchInput } from '@/components/app/list-controls';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { Badge } from '@/components/ui/badge';
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
import { useTeachersQuery } from '@/lib/api/teachers';

const SUBJECT_LIMIT = 3;

export function TeachersList() {
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const tSubject = useTranslations('subject');
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;

  const teachers = useTeachersQuery({ page, search });

  const columns = useMemo<ColumnDef<TeacherListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.teacher'),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.original.color ?? '#465FFF' }}
              aria-hidden="true"
            />
            <EntityAvatar
              avatarKey={row.original.avatarKey}
              fullName={row.original.fullName}
              size="md"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={`/app/teachers/${row.original.id}`}
                className="truncate font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                {row.original.fullName}
              </Link>
              {row.original.status === 'ARCHIVED' ? (
                <Badge variant="outline" className="w-fit">
                  {t('status.ARCHIVED')}
                </Badge>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: 'contacts',
        header: () => t('columns.contacts'),
        cell: ({ row }) => (
          <div className="flex flex-col text-sm">
            {row.original.phone ? <span>{row.original.phone}</span> : null}
            {row.original.email ? (
              <span className="text-muted-foreground">{row.original.email}</span>
            ) : null}
            {!row.original.phone && !row.original.email ? (
              <span className="text-muted-foreground">{tCommon('notProvided')}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'subjects',
        header: () => t('columns.subjects'),
        cell: ({ row }) =>
          row.original.subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {row.original.subjects.slice(0, SUBJECT_LIMIT).map((subject) => (
                <Badge key={subject} variant="secondary">
                  {tSubject(subject)}
                </Badge>
              ))}
              {row.original.subjects.length > SUBJECT_LIMIT ? (
                <Badge variant="outline">
                  +{row.original.subjects.length - SUBJECT_LIMIT}
                </Badge>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">{tCommon('notProvided')}</span>
          ),
      },
      {
        id: 'enrollments',
        header: () => t('columns.enrollments'),
        cell: ({ row }) => (
          <span>{t('enrollmentsCount', { count: row.original.activeEnrollmentCount })}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TeacherRowActions
              teacherId={row.original.id}
              fullName={row.original.fullName}
              showOpenLink={false}
            />
          </div>
        ),
      },
    ],
    [t, tCommon, tSubject],
  );

  const items = teachers.data?.items ?? [];
  const showEmpty = teachers.isSuccess && items.length === 0;

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
      </div>

      {teachers.isPending ? <ListSkeleton /> : null}

      {teachers.isError ? (
        <QueryErrorAlert
          error={teachers.error}
          title={t('error.title')}
          onRetry={() => void teachers.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <TeachersEmptyState search={search} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable columns={columns} data={items} caption={t('tableCaption')} />
          </div>
          <ListPagination page={page} totalPages={teachers.data?.totalPages ?? 1} />
        </>
      ) : null}

      <TeacherFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function TeachersEmptyState({ search, onCreate }: { search?: string; onCreate: () => void }) {
  const t = useTranslations('teachers');
  const scope = search ? 'emptySearch' : 'empty';

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PresentationIcon />
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
