'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
  ListPagination,
  ListSearchInput,
  ListStateFilter,
} from '@/components/app/list-controls';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import { DeletedBadge } from '@/components/app/status-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { nameInitials } from '@/lib/utils';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { parsePageParam, parseStateParam } from '@/lib/api/filters';
import { useParentsQuery } from '@/lib/api/parents';

export function ParentsList() {
  const t = useTranslations('parents');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const state = parseStateParam(searchParams.get('state'), isOwner);

  const parents = useParentsQuery({ page, search, state });

  const columns = useMemo<ColumnDef<ParentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.parent'),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{nameInitials(row.original.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              {row.original.deletedAt ? (
                <span className="truncate font-medium">{row.original.fullName}</span>
              ) : (
                <Link
                  href={`/app/parents/${row.original.id}`}
                  className="truncate font-medium underline-offset-4 hover:underline"
                >
                  {row.original.fullName}
                </Link>
              )}
              {row.original.deletedAt ? <DeletedBadge label={t('deletedBadge')} /> : null}
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
            {row.original.telegramUsername ? (
              <span className="text-muted-foreground">@{row.original.telegramUsername.replace(/^@/, '')}</span>
            ) : null}
            {!row.original.phone && !row.original.telegramUsername ? (
              <span className="text-muted-foreground">{tCommon('notProvided')}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'students',
        header: () => t('columns.students'),
        cell: ({ row }) =>
          row.original.students.length > 0 ? (
            <span>{row.original.students.map((student) => student.fullName).join(', ')}</span>
          ) : (
            <span className="text-muted-foreground">{tCommon('notProvided')}</span>
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
              isDeleted={Boolean(row.original.deletedAt)}
              showOpenLink={false}
            />
          </div>
        ),
      },
    ],
    [t, tCommon],
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        {isOwner ? <ListStateFilter value={state} /> : null}
      </div>

      {parents.isPending ? <ListSkeleton /> : null}

      {parents.isError ? (
        <QueryErrorAlert
          error={parents.error}
          title={t('error.title')}
          onRetry={() => void parents.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <ParentsEmptyState search={search} state={state} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((parent) => (
              <ParentCard key={parent.id} parent={parent} />
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable columns={columns} data={items} caption={t('tableCaption')} />
          </div>
          <ListPagination page={page} totalPages={parents.data?.totalPages ?? 1} />
        </>
      ) : null}

      <ParentFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ParentsEmptyState({
  search,
  state,
  onCreate,
}: {
  search?: string;
  state: 'active' | 'deleted' | 'all';
  onCreate: () => void;
}) {
  const t = useTranslations('parents');
  const scope = search ? 'emptySearch' : state === 'deleted' ? 'emptyDeleted' : 'empty';

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ContactIcon />
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
