'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BanknoteIcon,
  ChevronRightIcon,
  PackagePlusIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GroupDetail, GroupEnrollmentSummary } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LinkPickerDialog } from '@/components/shared/link-picker-dialog';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { compareMembers, rosterSummary, type MemberBillingState } from '@/features/packages';
import { useStudentLinkResults, useStudentLinkRow } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRelationshipLinks } from '@/hooks/use-relationship-links';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateGroupMutation } from '@/lib/api/groups';
import { queryKeys } from '@/lib/api/keys';
import type { GatewayError } from '@/lib/auth/client';
import { cn } from '@/lib/utils';
import { GroupMemberCard, type MemberAction } from './group-member-card';
import { OwnPriceBadge, useGroupMoney } from './member-price';
import { MemberPriceDialog } from './member-price-dialog';

const ADD_ID = 'group-add-student';
/** How long a saved row stays marked. */
const HIGHLIGHT_MS = 2400;

/**
 * «Склад групи» (S08 variant C): the heading with «+ Додати учня» (the outline
 * `sm` button of «+ Додати заняття», decision 4), the summary badges — who
 * needs a payment, who is paused, what is owed per currency —, one expanded
 * card per member in the order of their standing, and the soft «Продати
 * пакети кільком учням» row (decision 3). The members' billing comes from
 * `GET /groups/:id/billing`; without it the cards show who is in the group.
 *
 * The roster itself is saved as before: `LinkPickerDialog` from «+» (a sheet
 * on phones), a row menu to open a profile, change the member's price (L-11)
 * or remove them — asked in the neutral tone, the student and their history
 * stay —, the whole roster sent (`PATCH /groups/:id { students }`) through
 * `useRelationshipLinks`, so two quick edits never undo each other.
 */
export function GroupRosterCard({
  group,
  readOnly,
  pickerOpen,
  onPickerOpenChange,
  states,
  onMemberAction,
  onSellToMembers,
}: {
  group: GroupDetail;
  /** An archived group shows its roster without the commands. */
  readOnly: boolean;
  /** The hero opens the picker too, so its state lives above. */
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  /** Each member's standing by membership; empty while the billing read is not there. */
  states: ReadonlyMap<string, MemberBillingState>;
  onMemberAction?: (action: MemberAction, member: GroupEnrollmentSummary) => void;
  /** Opens «Продати пакет учасникам»; omitted, the row is not offered. */
  onSellToMembers?: () => void;
}) {
  const t = useTranslations('groups.roster');
  const tLinks = useTranslations('links');
  const tErrors = useTranslations('errors');
  const mobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: queryKeys.groups.detail(group.id) }) > 0;
  const { mutateAsync: updateGroup } = useUpdateGroupMutation(group.id);
  const toRow = useStudentLinkRow();

  const serverRows = useMemo(
    () => group.enrollments.map((enrollment) => toRow(enrollment.student)),
    [group.enrollments, toRow],
  );
  const teacherId = group.teacherId ?? group.teacher?.id;
  const save = useCallback(
    (studentIds: string[]) => updateGroup({ students: { studentIds, teacherId } }),
    [updateGroup, teacherId],
  );
  const refetch = useCallback(
    // Joins the read the save's invalidation already started instead of
    // cancelling it and sending a second one.
    () =>
      queryClient.refetchQueries(
        { queryKey: queryKeys.groups.detail(group.id) },
        { cancelRefetch: false },
      ),
    [queryClient, group.id],
  );
  const flow = useRelationshipLinks({
    serverRows,
    save,
    refetch,
    refreshing,
    pickerOpen,
    onPickerOpenChange,
  });
  const { results, loading } = useStudentLinkResults({
    ...flow.search,
    exclude: flow.links.linkedIds,
  });
  const picker = flow.pickerProps(results);
  const money = useGroupMoney();
  const [pricing, setPricing] = useState<GroupEnrollmentSummary | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  useEffect(() => {
    if (!highlighted) return;
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlighted]);
  const memberOf = useMemo(
    () => new Map(group.enrollments.map((enrollment) => [enrollment.studentId, enrollment])),
    [group.enrollments],
  );
  const groupPrice =
    group.pricePerLesson !== null && group.currency
      ? money(group.pricePerLesson, group.currency)
      : null;
  const addButton = () => document.getElementById(ADD_ID);
  const createStudent = () => router.push('/app/students/new');

  const stateOf = (studentId: string) => {
    const enrollment = memberOf.get(studentId);
    return enrollment ? (states.get(enrollment.id) ?? null) : null;
  };
  // In the order of their standing once it is known (owing first, paused last).
  const rows =
    states.size > 0
      ? [...flow.rows].sort((a, b) => {
          const left = stateOf(a.id);
          const right = stateOf(b.id);
          if (!left || !right) return Number(!left) - Number(!right);
          return compareMembers({ state: left, name: a.name }, { state: right, name: b.name });
        })
      : flow.rows;
  const summary = rosterSummary([...states.values()]);
  const heading = rows.length > 0 ? `${t('title')} · ${rows.length}` : t('title');

  const menuOf = (row: (typeof rows)[number], enrollment: GroupEnrollmentSummary | undefined) => (
    <DropdownMenu>
      <RowActionsTrigger label={tLinks('rowActions', { name: row.name })} className="md:size-8" />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/app/students/${row.id}`}>
              <UserIcon data-icon />
              {t('openProfile')}
            </Link>
          </DropdownMenuItem>
          {!readOnly && enrollment ? (
            <DropdownMenuItem onSelect={() => setPricing(enrollment)}>
              <BanknoteIcon data-icon />
              {t('changePrice')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        {readOnly ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={flow.busy}
                onSelect={() => flow.requestUnlink(row)}
              >
                <XIcon data-icon />
                {t('remove')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const metaOf = (enrollment: GroupEnrollmentSummary | undefined, fallback: string | undefined) => {
    if (!enrollment) return fallback;
    const level = enrollment.student.languageLevel;
    const price = money(enrollment.priceMinor, enrollment.currency);
    return (
      <span className="flex min-w-0 items-center gap-1">
        {level ? <span>{level} ·</span> : null}
        <span className={cn(enrollment.ownPrice && 'font-semibold text-foreground')}>{price}</span>
        {enrollment.ownPrice ? <OwnPriceBadge groupPrice={groupPrice} appearance="text" /> : null}
      </span>
    );
  };

  return (
    <>
      <Card
        data-slot="group-roster"
        className={cn(mobile ? 'gap-3 p-4' : 'gap-3.5 px-6 py-5.5', 'overflow-visible')}
      >
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h2 className={cn('font-semibold', mobile ? 'text-[15px]' : 'text-base')}>{heading}</h2>
          {readOnly ? null : (
            <Button
              id={ADD_ID}
              type="button"
              variant="outline"
              size="sm"
              disabled={flow.busy}
              onClick={flow.openPicker}
            >
              <PlusIcon data-icon="inline-start" />
              {mobile ? t('addShort') : t('add')}
            </Button>
          )}
        </div>

        {flow.links.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{tErrors(errorMessageKey(flow.links.error as GatewayError))}</span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="max-md:h-11"
                onClick={() => void flow.links.retry?.()}
              >
                {tLinks('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {summary.needPayment + summary.paused + summary.debts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {summary.needPayment > 0 ? (
              <Badge variant="warning">
                {t('summaryNeedPayment', { count: summary.needPayment })}
              </Badge>
            ) : null}
            {summary.paused > 0 ? (
              <Badge variant="neutral">{t('summaryPaused', { count: summary.paused })}</Badge>
            ) : null}
            {summary.debts.map((debt) => (
              <Badge key={debt.currency} variant="danger">
                {t('summaryDebt', { amount: money(debt.minor, debt.currency) })}
              </Badge>
            ))}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => {
              const enrollment = memberOf.get(row.id);
              return (
                <li key={row.id}>
                  <GroupMemberCard
                    name={row.name}
                    avatarKey={row.avatarKey ?? null}
                    href={`/app/students/${row.id}`}
                    hrefLabel={tLinks('openProfileOf', { name: row.name })}
                    meta={metaOf(enrollment, typeof row.meta === 'string' ? row.meta : undefined)}
                    state={stateOf(row.id)}
                    menu={menuOf(row, enrollment)}
                    onAction={
                      !readOnly && enrollment && onMemberAction
                        ? (action) => onMemberAction(action, enrollment)
                        : undefined
                    }
                    highlighted={enrollment ? highlighted === enrollment.id : false}
                    compact={mobile}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            <p className="text-sm leading-5 text-muted-foreground">{t('empty')}</p>
            {readOnly ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="max-md:h-11"
                  onClick={flow.openPicker}
                >
                  <SearchIcon data-icon="inline-start" />
                  {t('linkExisting')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="max-md:h-11"
                  onClick={createStudent}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t('createStudent')}
                </Button>
              </div>
            )}
          </>
        )}

        {!readOnly && onSellToMembers && rows.length > 0 ? (
          <button
            type="button"
            onClick={onSellToMembers}
            className="flex items-center gap-3 rounded-row bg-tint-indigo px-4 py-3 text-left text-tint-indigo-foreground transition-shadow outline-none hover:shadow-raise focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-brand [&_svg]:size-4.5"
            >
              <PackagePlusIcon />
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-sm leading-5 font-semibold">{t('sellTitle')}</span>
              <span className="text-xs leading-4">{t('sellText')}</span>
            </span>
            <ChevronRightIcon aria-hidden="true" className="size-4.5 shrink-0" />
          </button>
        ) : null}
      </Card>

      {readOnly ? null : (
        <LinkPickerDialog
          {...picker}
          loading={loading}
          title={t('pickerTitle')}
          subtitle={group.name}
          confirmLabel={t(mobile ? 'confirmMobile' : 'confirm', { count: picker.selected.length })}
          createLabel={t('pickerCreate')}
          onCreate={createStudent}
          returnFocus={addButton}
        />
      )}

      <MemberPriceDialog
        group={group}
        member={pricing}
        onOpenChange={(open) => (open ? undefined : setPricing(null))}
        onSaved={setHighlighted}
      />

      <ConfirmDialog
        open={flow.unlink.target !== null}
        onOpenChange={(open) => (open ? undefined : flow.unlink.cancel())}
        tone="neutral"
        title={t('removeTitle', { name: flow.unlink.target?.name ?? '' })}
        description={t('removeText')}
        confirmLabel={t('removeAction')}
        pending={flow.unlink.pending}
        onConfirm={flow.unlink.confirm}
        returnFocus={addButton}
      />
    </>
  );
}
