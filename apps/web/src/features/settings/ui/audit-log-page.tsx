'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  ChevronDownIcon,
  HistoryIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useNow, useTranslations } from 'next-intl';
import type { AuditLogListItem } from '@tutorio/validation';
import { EmptyState } from '@/components/shared/empty-state';
import { useUpdateSearchParams } from '@/components/shared/list-controls';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { PageHeader } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useIsBelowDesktop, useIsMobile } from '@/hooks/use-mobile';
import { useAuditFeedQuery } from '@/lib/api/audit';
import { useWorkspaceMembersQuery } from '@/lib/api/workspace';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import {
  AUDIT_PAGE_SIZE,
  AUDIT_PARAM,
  auditQuery,
  filtersActive,
  groupByDay,
  periodParams,
  readAuditFilters,
  resetAuditParams,
} from '../model/audit';
import { AuditList, type AuditActor } from './audit-list';
import { useAuditPeriodLabel } from './audit-period-menu';
import { AuditToolbar, type AuditMember, type AuditToolbarActions } from './audit-toolbar';
import { useAuditFormat } from './use-audit-format';

function StateCard({ children }: { children: React.ReactNode }) {
  return <Card className="py-0">{children}</Card>;
}

function AuditSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Card className="gap-0 px-3 py-4" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex h-16 items-center gap-4 px-5">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="size-9 rounded-control" />
            <div className="flex w-48 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-20 rounded-pill max-md:hidden" />
            <Skeleton className="h-4 grow max-md:hidden" />
          </div>
        ))}
      </Card>
    </div>
  );
}

/**
 * The change log (`/app/settings/audit`, S10 board 04): who changed what,
 * newest first, grouped by day, filtered by what changed, the action, who
 * and the period (the last 7 days by default, all in the URL). A row opens
 * into its diff; «Показати ще» reads the next page into the same list.
 */
export function AuditLogPage({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('settings.audit');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const params = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const clock = useNow();
  const [now] = useState(() => nowMs ?? clock.getTime());
  const timeZone = useStudioTimeZone();
  const compact = useIsMobile();
  // The six columns need a desktop; a tablet beside the sidebar gets the cards.
  const cards = useIsBelowDesktop() || compact;
  const [openId, setOpenId] = useState<string | null>(null);
  const periodLabel = useAuditPeriodLabel();
  useSetPageCrumb(t('title'));

  const filters = useMemo(() => readAuditFilters(params), [params]);
  const feed = useAuditFeedQuery(auditQuery(filters, now, timeZone));
  const membersQuery = useWorkspaceMembersQuery();

  const members: AuditMember[] = useMemo(
    () =>
      (membersQuery.data?.items ?? []).map((member) => ({
        userId: member.userId,
        name: member.name,
        avatarKey: member.avatarKey ?? null,
      })),
    [membersQuery.data],
  );
  const pages = feed.data?.pages;
  const items = useMemo(() => (pages ?? []).flatMap((page) => page.items), [pages]);
  const names = useMemo(
    () => Object.assign({}, ...(pages ?? []).map((page) => page.names)) as Record<string, string>,
    [pages],
  );
  const total = pages?.at(-1)?.total ?? 0;
  const format = useAuditFormat(names);
  const days = useMemo(() => groupByDay(items, timeZone), [items, timeZone]);

  const actorOf = (item: AuditLogListItem): AuditActor | null => {
    if (!item.actor) return null;
    const member = members.find((entry) => entry.userId === item.actor?.id);
    return { name: item.actor.name, avatarKey: member?.avatarKey ?? null };
  };

  const set = (updates: Record<string, string | undefined>) => {
    setOpenId(null);
    updateParams(updates);
  };
  const actions: AuditToolbarActions = {
    onEntity: (entity) => set({ [AUDIT_PARAM.entity]: entity ?? undefined }),
    onAction: (action) => set({ [AUDIT_PARAM.action]: action ?? undefined }),
    onActor: (actorId) => set({ [AUDIT_PARAM.actor]: actorId ?? undefined }),
    onPeriod: (period, range) => set(periodParams(period, range)),
    onApply: (draft) =>
      set({
        [AUDIT_PARAM.entity]: draft.entity ?? undefined,
        [AUDIT_PARAM.action]: draft.action ?? undefined,
        [AUDIT_PARAM.actor]: draft.actorId ?? undefined,
      }),
    onReset: () => set(resetAuditParams()),
  };

  const actorName = members.find((member) => member.userId === filters.actorId)?.name ?? null;
  const summary = [
    actorName,
    filters.action ? t(`action.${filters.action}`).toLocaleLowerCase(locale) : null,
    filters.entity ? t(`entityPlural.${filters.entity}`) : null,
    periodLabel(filters, now),
  ]
    .filter(Boolean)
    .join(' · ');
  const nextCount = Math.min(AUDIT_PAGE_SIZE, total - items.length);

  let body: React.ReactNode;
  if (feed.isPending) {
    body = <AuditSkeleton label={tCommon('loading')} />;
  } else if (feed.isError && items.length === 0) {
    body = (
      <StateCard>
        <div role="alert">
          <EmptyState
            framed={false}
            minHeight={0}
            className="py-12"
            media={
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-tile bg-tint-danger text-tint-danger-foreground [&_svg]:size-6"
              >
                <AlertCircleIcon />
              </span>
            }
            title={t('error.title')}
            text={t('error.text')}
            action={
              <Button type="button" disabled={feed.isFetching} onClick={() => void feed.refetch()}>
                <RotateCcwIcon data-icon="inline-start" />
                {t('error.retry')}
              </Button>
            }
          />
        </div>
      </StateCard>
    );
  } else if (items.length === 0) {
    body = filtersActive(filters) ? (
      <StateCard>
        <EmptyState
          framed={false}
          minHeight={0}
          className="py-12"
          icon={<SearchIcon />}
          title={t('noResults.title')}
          text={t('noResults.text', { summary })}
          action={
            <Button type="button" variant="outline" onClick={actions.onReset}>
              <XIcon data-icon="inline-start" />
              {t('noResults.reset')}
            </Button>
          }
        />
      </StateCard>
    ) : (
      <StateCard>
        <EmptyState
          framed={false}
          minHeight={0}
          className="py-12"
          icon={<HistoryIcon />}
          title={t('empty.title')}
          text={t('empty.text')}
        />
      </StateCard>
    );
  } else {
    body = (
      <>
        <AuditList
          days={days}
          actorOf={actorOf}
          format={format}
          openId={openId}
          onOpen={setOpenId}
          compact={cards}
        />
        <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
          <span role="status">
            {feed.hasNextPage
              ? t(compact ? 'shownShort' : 'shown', { shown: items.length, total })
              : t('records', { count: total })}
          </span>
          {feed.hasNextPage ? (
            <Button
              type="button"
              variant="ghost"
              disabled={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
            >
              {feed.isFetchingNextPage ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ChevronDownIcon data-icon="inline-start" />
              )}
              {compact ? t('moreShort') : t('more', { count: nextCount })}
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader size="lg" title={t('title')} description={t('subtitle')} />
      <AuditToolbar
        filters={filters}
        members={members}
        now={now}
        compact={compact}
        actions={actions}
      />
      {body}
    </div>
  );
}
