'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { LayersIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { GroupCard } from './group-card';
import { GroupRowActions } from './group-row-actions';
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
import { useGroupsQuery } from '@/lib/api/groups';

export function GroupsList() {
  const t = useTranslations('groups');
  const searchParams = useSearchParams();
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const state = parseStateParam(searchParams.get('state'), isOwner);

  const groups = useGroupsQuery({ page, search, state });

  const columns = useMemo<ColumnDef<GroupListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => t('columns.group'),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-1">
            {row.original.deletedAt ? (
              <span className="truncate font-medium">{row.original.name}</span>
            ) : (
              <Link
                href={`/app/groups/${row.original.id}`}
                className="truncate font-medium underline-offset-4 hover:underline"
              >
                {row.original.name}
              </Link>
            )}
            {row.original.deletedAt ? <DeletedBadge label={t('deletedBadge')} /> : null}
          </div>
        ),
      },
      {
        id: 'students',
        header: () => t('columns.students'),
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground">
            {t('studentCount', { count: row.original.activeStudentCount })}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <GroupRowActions
              groupId={row.original.id}
              name={row.original.name}
              isDeleted={Boolean(row.original.deletedAt)}
            />
          </div>
        ),
      },
    ],
    [t],
  );

  const items = groups.data?.items ?? [];
  const showEmpty = groups.isSuccess && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button asChild className="h-11 md:h-9">
            <Link href="/app/groups/new">
              <PlusIcon data-icon />
              {t('add')}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        {isOwner ? <ListStateFilter value={state} /> : null}
      </div>

      {groups.isPending ? <ListSkeleton /> : null}

      {groups.isError ? (
        <QueryErrorAlert
          error={groups.error}
          title={t('error.title')}
          onRetry={() => void groups.refetch()}
        />
      ) : null}

      {showEmpty ? <GroupsEmptyState search={search} state={state} /> : null}

      {items.length > 0 ? (
        <>
          {/* Mobile: cards. Desktop: an accessible table. */}
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable columns={columns} data={items} caption={t('tableCaption')} />
          </div>
          <ListPagination page={page} totalPages={groups.data?.totalPages ?? 1} />
        </>
      ) : null}
    </div>
  );
}

function GroupsEmptyState({
  search,
  state,
}: {
  search?: string;
  state: 'active' | 'deleted' | 'all';
}) {
  const t = useTranslations('groups');
  const scope = search ? 'emptySearch' : state === 'deleted' ? 'emptyDeleted' : 'empty';

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayersIcon />
        </EmptyMedia>
        <EmptyTitle>{t(`${scope}.title`)}</EmptyTitle>
        <EmptyDescription>{t(`${scope}.description`)}</EmptyDescription>
      </EmptyHeader>
      {scope === 'empty' ? (
        <EmptyContent>
          <Button asChild>
            <Link href="/app/groups/new">
              <PlusIcon data-icon />
              {t('empty.action')}
            </Link>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
