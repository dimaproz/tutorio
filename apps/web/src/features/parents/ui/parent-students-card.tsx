'use client';

import { useCallback, useMemo } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentDetail } from '@tutorio/validation';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useRelationshipLinks } from '@/hooks/use-relationship-links';
import { errorMessageKey } from '@/lib/api/error-message';
import { queryKeys } from '@/lib/api/keys';
import { useUpdateParentMutation } from '@/lib/api/parents';
import type { GatewayError } from '@/lib/auth/client';
import { useStudentLinkResults, useStudentLinkRow } from '@/features/students';

const ADD_ID = 'parent-link-student';

/**
 * The students a parent represents — the parent's side of the relationship
 * whose student side is `StudentParentsCard`. Both run on
 * `useRelationshipLinks` and render one `LinkedCard` with one
 * `LinkPickerDialog`, so the two sides cannot drift apart.
 */
export function ParentStudentsCard({
  parent,
  pickerOpen,
  onPickerOpenChange,
}: {
  parent: ParentDetail;
  /** The profile hero opens the picker too, so its state lives above. */
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('parents.links');
  const tLinks = useTranslations('links');
  const tErrors = useTranslations('errors');
  const mobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: queryKeys.parents.detail(parent.id) }) > 0;
  const { mutateAsync: updateParent } = useUpdateParentMutation(parent.id);
  const toRow = useStudentLinkRow();

  const serverRows = useMemo(() => parent.students.map(toRow), [parent.students, toRow]);
  const save = useCallback((studentIds: string[]) => updateParent({ studentIds }), [updateParent]);
  const refetch = useCallback(
    // Joins the read the save's invalidation already started instead of
    // cancelling it and sending a second one.
    () =>
      queryClient.refetchQueries(
        { queryKey: queryKeys.parents.detail(parent.id) },
        { cancelRefetch: false },
      ),
    [queryClient, parent.id],
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
  const addButton = () => document.getElementById(ADD_ID);

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
                {tLinks('openProfile')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={flow.busy}
              onSelect={() => flow.requestUnlink(row)}
            >
              <XIcon data-icon />
              {t('unlink')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }));

  return (
    <>
      <LinkedCard
        title={t('title')}
        items={items}
        addLabel={tLinks('link')}
        addId={ADD_ID}
        onAdd={flow.openPicker}
        addDisabled={flow.busy}
        emptyText={t('empty')}
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

      <LinkPickerDialog
        {...flow.pickerProps(results)}
        loading={loading}
        title={t('pickerTitle')}
        subtitle={parent.fullName}
        createLabel={t('createStudent')}
        onCreate={() => router.push('/app/students/new')}
        returnFocus={addButton}
      />

      <ConfirmDialog
        open={flow.unlink.target !== null}
        onOpenChange={(open) => (open ? undefined : flow.unlink.cancel())}
        tone="neutral"
        title={t('unlinkTitle')}
        description={t('unlinkText', { name: flow.unlink.target?.name ?? '' })}
        confirmLabel={tLinks('unlink')}
        pending={flow.unlink.pending}
        onConfirm={flow.unlink.confirm}
        returnFocus={addButton}
      />
    </>
  );
}
