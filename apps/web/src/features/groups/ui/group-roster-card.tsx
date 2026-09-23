'use client';

import { useCallback, useMemo } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon, SearchIcon, UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GroupDetail } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LinkedCard } from '@/components/shared/linked-card';
import { LinkPickerDialog } from '@/components/shared/link-picker-dialog';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useStudentLinkResults, useStudentLinkRow } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRelationshipLinks } from '@/hooks/use-relationship-links';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateGroupMutation } from '@/lib/api/groups';
import { queryKeys } from '@/lib/api/keys';
import type { GatewayError } from '@/lib/auth/client';

const ADD_ID = 'group-add-student';

/**
 * The group's roster on the shared linking components: one `LinkedCard`, the
 * `LinkPickerDialog` from "+ Add student" (a sheet on phones), and a row menu
 * to open a profile or remove the student. Removing asks first, in the
 * neutral tone: the student and their history stay. Every save sends the
 * whole roster (`PATCH /groups/:id { students }`, replace semantics) through
 * `useRelationshipLinks`, which keeps the last sent set authoritative until
 * the refetched group arrives, so two quick edits never undo each other.
 */
export function GroupRosterCard({
  group,
  readOnly,
  pickerOpen,
  onPickerOpenChange,
}: {
  group: GroupDetail;
  /** An archived group shows its roster without the commands. */
  readOnly: boolean;
  /** The hero opens the picker too, so its state lives above. */
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
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
  const addButton = () => document.getElementById(ADD_ID);
  const createStudent = () => router.push('/app/students/new');

  const items = flow.rows.map((row) => ({
    ...row,
    href: `/app/students/${row.id}`,
    hrefLabel: tLinks('openProfileOf', { name: row.name }),
    menu: (
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
    ),
  }));

  return (
    <>
      <LinkedCard
        title={t('title')}
        items={items}
        addLabel={readOnly ? undefined : mobile ? t('addShort') : t('add')}
        addId={ADD_ID}
        onAdd={flow.openPicker}
        addDisabled={flow.busy}
        emptyText={t('empty')}
        actions={
          readOnly
            ? []
            : [
                { label: t('linkExisting'), icon: SearchIcon, onClick: flow.openPicker },
                {
                  label: t('createStudent'),
                  icon: PlusIcon,
                  variant: 'ghost',
                  onClick: createStudent,
                },
              ]
        }
        size={mobile ? 'sm' : 'md'}
      >
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
      </LinkedCard>

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
