'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayersIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GroupCard } from './group-card';
import { GroupFormDialog } from './group-form-dialog';
import {
  ListPagination,
  ListSearchInput,
  ListStateFilter,
} from '@/components/app/list-controls';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
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
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const state = parseStateParam(searchParams.get('state'), isOwner);

  const groups = useGroupsQuery({ page, search, state });

  const items = groups.data?.items ?? [];
  const showEmpty = groups.isSuccess && items.length === 0;

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

      {groups.isPending ? <ListSkeleton /> : null}

      {groups.isError ? (
        <QueryErrorAlert
          error={groups.error}
          title={t('error.title')}
          onRetry={() => void groups.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <GroupsEmptyState search={search} state={state} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
          <ListPagination page={page} totalPages={groups.data?.totalPages ?? 1} />
        </>
      ) : null}

      <GroupFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function GroupsEmptyState({
  search,
  state,
  onCreate,
}: {
  search?: string;
  state: 'active' | 'deleted' | 'all';
  onCreate: () => void;
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
          <Button onClick={onCreate}>
            <PlusIcon data-icon />
            {t('empty.action')}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
