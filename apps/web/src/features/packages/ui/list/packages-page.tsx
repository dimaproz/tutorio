'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PackagePlusIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { useIsSoloWorkspace } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { ListPagination, useUpdateSearchParams } from '@/components/shared/list-controls';
import { PageHeader } from '@/components/shared/page-shell';
import {
  useGroupOptionsQuery,
  usePackagePageQuery,
  useStudentQuery,
  useTeachersQuery,
} from '../../api';
import { listQuery, PARAM, pillsActive, readListState, resetParams } from '../../model/list';
import { ExtendDialog } from '../operations/extend-dialog';
import { PackagePaymentDialog } from '../operations/payment-dialog';
import { RefundDialog } from '../operations/refund-dialog';
import { TransferDialog } from '../operations/transfer-dialog';
import { PackageTicketModal } from '../package-ticket-modal';
import { PackageSaleDialog } from '../sale/package-sale-dialog';
import { usePackageFormat } from '../use-package-format';
import { usePackageTicket } from '../use-package-ticket';
import { usePackageTitle } from '../use-package-title';
import { PackageCard } from './package-card';
import type { ListPackage } from './package-cells';
import type { RowAction } from './package-row-menu';
import { PACKAGES_ROW_LAYOUT, usePackagesColumns } from './packages-columns';
import {
  PackagesEmpty,
  PackagesError,
  PackagesNoResults,
  PackagesSkeleton,
} from './packages-states';
import { PackagesToolbar, type ToolbarActions } from './packages-toolbar';

const TEACHER_FILTERS = { page: 1, pageSize: 100, state: 'all' as const };

/**
 * «Пакети» (S07 board 04, `/app/packages`, decision 10): every package of
 * the studio by tab — active, running out, unpaid, finished, all — with
 * counts, the teacher, student or group and kind filters, a search and the
 * order, all in the URL; the header sums the unpaid money per currency. A
 * row opens its ticket (`?package=`); its ⋯ runs an operation; «Продати
 * пакет» starts a sale with a direction picker.
 */
export function PackagesPage({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('packages.list');
  const tCommon = useTranslations('common');
  const params = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const clock = useNow();
  const [now] = useState(() => (nowMs ? new Date(nowMs) : clock));
  const solo = useIsSoloWorkspace();
  const format = usePackageFormat();
  const titleOf = usePackageTitle();
  const state = useMemo(() => readListState(params), [params]);
  const ticket = usePackageTicket();
  const [selling, setSelling] = useState(false);
  const [operation, setOperation] = useState<{ action: RowAction; pkg: ListPackage } | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const packages = usePackagePageQuery(listQuery(state));
  const data = packages.data;
  const items = data?.items ?? [];
  const threshold = data?.lowCreditThreshold ?? 2;
  const studioEmpty = data?.counts.all === 0 && !pillsActive(state) && !state.search;

  const teacherRows = useTeachersQuery(TEACHER_FILTERS);
  const teachers = useMemo(
    () =>
      (teacherRows.data?.items ?? [])
        .filter((teacher) => !teacher.deletedAt && teacher.status !== 'ARCHIVED')
        .map((teacher) => ({
          id: teacher.id,
          fullName: teacher.fullName,
          avatarKey: teacher.avatarKey,
        })),
    [teacherRows.data],
  );
  const student = useStudentQuery(state.studentId ?? '', Boolean(state.studentId));
  const groups = useGroupOptionsQuery(Boolean(state.groupId));
  const whoId = state.studentId ?? state.groupId;
  const whoName =
    (picked && picked.id === whoId ? picked.name : null) ??
    (state.studentId
      ? (student.data?.fullName ?? null)
      : (groups.data?.items.find((group) => group.id === state.groupId)?.name ?? null));
  const teacherName = teachers.find((teacher) => teacher.id === state.teacherId)?.fullName ?? null;

  const openTicket = ticket.open;
  const onAction = useCallback(
    (action: RowAction, pkg: ListPackage) => {
      if (action === 'open') openTicket(pkg.id);
      else setOperation({ action, pkg });
    },
    [openTicket],
  );
  const columns = usePackagesColumns({ now, threshold, format, onAction });

  const set = (updates: Record<string, string | undefined>) =>
    updateParams(updates, { resetPage: true });
  const actions: ToolbarActions = {
    onTab: (tab) => set({ [PARAM.tab]: tab === 'ACTIVE' ? undefined : tab }),
    onSearch: (search) => set({ [PARAM.search]: search.trim() || undefined }),
    onTeacher: (teacherId) => set({ [PARAM.teacher]: teacherId ?? undefined }),
    onWho: (who, name) => {
      if (who && name) setPicked({ id: who.id, name });
      set({
        [PARAM.student]: who?.kind === 'student' ? who.id : undefined,
        [PARAM.group]: who?.kind === 'group' ? who.id : undefined,
      });
    },
    onKind: (kind) => set({ [PARAM.kind]: kind ?? undefined }),
    onSort: (sort) => set({ [PARAM.sort]: sort === 'ending' ? undefined : sort }),
    onReset: () => set(resetParams()),
  };

  const counts = data?.counts;
  const owed = (data?.owed ?? [])
    .filter((row) => row.amountMinor > 0)
    .map((row) => format.money(row.amountMinor, row.currency))
    .join(' · ');
  const description = !counts ? tCommon('loading') : studioEmpty ? t('subtitleEmpty') : null;
  const summary = [
    teacherName,
    whoName,
    state.kind ? t(`kindSummary.${state.kind}`) : null,
    state.search ? `«${state.search}»` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const showing = data ? t('showing', { shown: items.length, total: data.total }) : '';
  const closeOperation = () => setOperation(null);
  const operationProps = operation
    ? {
        pkg: operation.pkg,
        title: titleOf(operation.pkg),
        onClose: closeOperation,
        onDone: closeOperation,
      }
    : null;

  return (
    <>
      <CollectionFrame
        header={
          <PageHeader
            size="xl"
            title={t('title')}
            description={
              description ?? (
                <>
                  <span className="md:hidden">
                    {t('subtitleShort', { active: counts!.active, unpaid: counts!.unpaid })}
                  </span>
                  <span className="hidden md:inline">
                    {owed
                      ? t('subtitle', {
                          active: counts!.active,
                          ending: counts!.ending,
                          unpaid: counts!.unpaid,
                          owed,
                        })
                      : t('subtitlePaid', { active: counts!.active, ending: counts!.ending })}
                  </span>
                </>
              )
            }
            action={
              <Button
                type="button"
                size="xl"
                leading={<PackagePlusIcon />}
                className="max-md:h-11"
                onClick={() => setSelling(true)}
              >
                <span className="md:hidden">{t('sellShort')}</span>
                <span className="hidden md:inline">{t('sell')}</span>
              </Button>
            }
          />
        }
        toolbar={
          studioEmpty ? undefined : (
            <PackagesToolbar
              state={state}
              counts={counts}
              solo={solo}
              teachers={teachers}
              whoName={whoName}
              actions={actions}
            />
          )
        }
        loading={packages.isPending ? <PackagesSkeleton label={tCommon('loading')} /> : undefined}
        error={
          packages.isError && !data ? (
            <PackagesError retrying={packages.isFetching} onRetry={() => void packages.refetch()} />
          ) : undefined
        }
        empty={
          data && items.length === 0 ? (
            studioEmpty ? (
              <PackagesEmpty />
            ) : (
              <PackagesNoResults summary={summary} onReset={() => set(resetParams(true))} />
            )
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  now={now}
                  threshold={threshold}
                  format={format}
                  onOpen={() => ticket.open(pkg.id)}
                />
              ))
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <div className="flex flex-col rounded-card bg-card p-2">
              <DataTable
                variant="rows"
                layout={PACKAGES_ROW_LAYOUT}
                rowHeight="auto"
                columns={columns}
                data={items}
                caption={t('caption')}
                loading={packages.isFetching && !packages.isPending}
                isRowDimmed={(pkg) => pkg.remainingCredits <= 0}
                isRowHighlighted={(pkg) => pkg.id === ticket.packageId}
              />
              <div className="mt-2 flex min-h-12 items-center justify-between border-t border-border px-4 pt-3 pb-2">
                <span className="text-[13px] text-muted-foreground">{showing}</span>
                <ListPagination page={state.page} totalPages={data?.totalPages ?? 1} />
              </div>
            </div>
          ) : undefined
        }
        pagination={
          items.length > 0 ? (
            <div className="flex flex-col items-center gap-3 md:hidden">
              <ListPagination page={state.page} totalPages={data?.totalPages ?? 1} />
              <span className="text-[13px] text-muted-foreground">{showing}</span>
            </div>
          ) : undefined
        }
      />

      <PackageTicketModal
        packageId={ticket.packageId}
        onClose={ticket.close}
        studentHref={(id) => `/app/students/${id}`}
        nowMs={nowMs}
      />
      <PackageSaleDialog open={selling} onOpenChange={setSelling} nowMs={nowMs} />
      {operationProps && operation?.action === 'pay' ? (
        <PackagePaymentDialog {...operationProps} />
      ) : null}
      {operationProps && operation?.action === 'extend' ? (
        <ExtendDialog {...operationProps} />
      ) : null}
      {operationProps && operation?.action === 'transfer' ? (
        <TransferDialog {...operationProps} />
      ) : null}
      {operationProps && operation?.action === 'refund' ? (
        <RefundDialog {...operationProps} />
      ) : null}
    </>
  );
}
