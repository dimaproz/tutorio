'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayersIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GroupCard } from './group-card';
import { GroupFormDialog } from './group-form-dialog';
import { ListPagination, ListSearchInput, ListSelectFilter } from '@/components/app/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import { CollectionEmptyState, CollectionToolbar, LoadingPanel } from '@/components/shared';
import { parsePageParam, parseStateParam } from '@/lib/api/filters';
import { useGroupsQuery } from '@/lib/api/groups';
import { useStudentsQuery } from '@/lib/api/students';

const GROUP_STATUSES = ['ACTIVE', 'EMPTY'] as const;

export function GroupsList() {
  const t = useTranslations('groups');
  const tStatus = useTranslations('groups.status');
  const tFilters = useTranslations('groups.filters');
  const searchParams = useSearchParams();
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const state = parseStateParam(searchParams.get('state'), isOwner);
  const status = searchParams.get('status') || undefined;
  const studentId = searchParams.get('studentId') || undefined;

  const groups = useGroupsQuery({
    page,
    search,
    state,
    status,
    studentId,
    sort: 'name',
    order: 'asc',
  });
  const students = useStudentsQuery({ page: 1, pageSize: 100 });

  const statusOptions = GROUP_STATUSES.map((value) => ({
    value,
    label: tStatus(value),
  }));
  const studentOptions = (students.data?.items ?? []).map((student) => ({
    value: student.id,
    label: student.fullName,
  }));

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

      <CollectionToolbar>
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        <ListSelectFilter
          paramKey="status"
          value={status}
          options={statusOptions}
          label={tFilters('statusAll')}
        />
        <ListSelectFilter
          paramKey="studentId"
          value={studentId}
          options={studentOptions}
          label={tFilters('studentAll')}
        />
      </CollectionToolbar>

      {groups.isPending ? <LoadingPanel size="lg" /> : null}

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
          <div className="grid gap-4 xl:grid-cols-3">
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
    <CollectionEmptyState
      icon={LayersIcon}
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
