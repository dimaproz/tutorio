'use client';

import { useCallback, useMemo, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarPlusIcon, UserIcon, XIcon } from 'lucide-react';
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
import { LessonFormDialog } from '@/features/scheduling';
import { StudentQuickCreateDialog } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRelationshipLinks } from '@/hooks/use-relationship-links';
import { errorMessageKey } from '@/lib/api/error-message';
import { queryKeys } from '@/lib/api/keys';
import { useUpdateParentMutation } from '@/lib/api/parents';
import type { GatewayError } from '@/lib/auth/client';
import { useStudentLinkResults, useStudentLinkRow } from './use-link-results';

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
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: queryKeys.parents.detail(parent.id) }) > 0;
  const { mutateAsync: updateParent } = useUpdateParentMutation(parent.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const toRow = useStudentLinkRow();

  const serverRows = useMemo(() => parent.students.map(toRow), [parent.students, toRow]);
  const archived = useMemo(
    () =>
      new Set(parent.students.filter((student) => student.status === 'ARCHIVED').map((s) => s.id)),
    [parent.students],
  );
  const save = useCallback((studentIds: string[]) => updateParent({ studentIds }), [updateParent]);
  const refetch = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeys.parents.detail(parent.id) }),
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
              <Link href={`/app/students/${row.id}`}>
                <UserIcon data-icon />
                {tLinks('openProfile')}
              </Link>
            </DropdownMenuItem>
            {!archived.has(row.id) ? (
              <DropdownMenuItem onSelect={() => setScheduleFor(row.id)}>
                <CalendarPlusIcon data-icon />
                {t('schedule')}
              </DropdownMenuItem>
            ) : null}
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
        onCreate={() => setCreateOpen(true)}
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

      <StudentQuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        navigateOnSuccess={false}
        onSuccess={(student) => flow.linkCreated(toRow(student))}
      />

      <LessonFormDialog
        open={scheduleFor !== null}
        onOpenChange={(open) => (open ? undefined : setScheduleFor(null))}
        lockedStudentId={scheduleFor ?? undefined}
      />
    </>
  );
}
