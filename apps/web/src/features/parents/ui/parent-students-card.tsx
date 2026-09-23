'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarPlusIcon, UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
import { useLinkedSet } from '@/hooks/use-linked-set';
import { errorMessageKey } from '@/lib/api/error-message';
import { queryKeys } from '@/lib/api/keys';
import { useUpdateParentMutation } from '@/lib/api/parents';
import { useStudentsQuery } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';

/**
 * The students a parent represents — the parent's side of the relationship
 * whose student side is `StudentParentsCard`. Both are one `LinkedCard` with
 * one `LinkPickerDialog`, and both save the whole set through `useLinkedSet`,
 * so two quick edits never undo each other.
 */
export function ParentStudentsCard({
  parent,
  pickerOpen,
  onPickerOpenChange,
}: {
  parent: ParentDetail;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('parents.links');
  const tLinks = useTranslations('links');
  const tStatus = useTranslations('studentStatus');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const mobile = useIsMobile();
  const queryClient = useQueryClient();
  const { mutateAsync: updateParent } = useUpdateParentMutation(parent.id);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [unlinking, setUnlinking] = useState<{ id: string; name: string } | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);

  const serverIds = useMemo(() => parent.students.map((student) => student.id), [parent.students]);
  const save = useCallback((studentIds: string[]) => updateParent({ studentIds }), [updateParent]);
  const confirm = useCallback(async () => {
    const key = queryKeys.parents.detail(parent.id);
    await queryClient.refetchQueries({ queryKey: key });
    return queryClient.getQueryState(key)?.status === 'success';
  }, [parent.id, queryClient]);
  const links = useLinkedSet({ serverIds, save, confirm });

  const students = useStudentsQuery(
    { page: 1, pageSize: 20, search: search.trim() || undefined },
    pickerOpen,
  );
  const results = (students.data?.items ?? [])
    .filter((student) => !links.linkedIds.includes(student.id))
    .map((student) => ({
      id: student.id,
      name: student.fullName,
      avatarKey: student.avatarKey,
      meta: [tStatus(student.status), student.groupNames[0]].filter(Boolean).join(' · '),
    }));

  const closePicker = () => {
    onPickerOpenChange(false);
    setSearch('');
    setSelected([]);
  };
  const report = (saved: boolean, message: string) =>
    saved ? toast.success(message) : toast.error(tLinks('saveError'));

  const items = parent.students.map((student) => ({
    id: student.id,
    name: student.fullName,
    avatarKey: student.avatarKey,
    meta: [student.languageLevel, tStatus(student.status).toLowerCase()]
      .filter(Boolean)
      .join(' · '),
    href: `/app/students/${student.id}`,
    hrefLabel: tLinks('openProfileOf', { name: student.fullName }),
    menu: (
      <DropdownMenu>
        <RowActionsTrigger
          label={tLinks('rowActions', { name: student.fullName })}
          className="md:size-8"
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/app/students/${student.id}`}>
                <UserIcon data-icon />
                {tLinks('openProfile')}
              </Link>
            </DropdownMenuItem>
            {student.status !== 'ARCHIVED' ? (
              <DropdownMenuItem onSelect={() => setScheduleFor(student.id)}>
                <CalendarPlusIcon data-icon />
                {t('schedule')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={links.busy}
              onSelect={() => setUnlinking({ id: student.id, name: student.fullName })}
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
        onAdd={() => onPickerOpenChange(true)}
        addDisabled={links.busy}
        emptyText={t('empty')}
        size={mobile ? 'sm' : 'md'}
      >
        {links.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{tErrors(errorMessageKey(links.error as GatewayError))}</span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void links.retry?.()}
              >
                {tLinks('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </LinkedCard>

      <LinkPickerDialog
        open={pickerOpen}
        onOpenChange={(open) => (open ? onPickerOpenChange(true) : closePicker())}
        title={t('pickerTitle')}
        subtitle={parent.fullName}
        searchLabel={tLinks('searchLabel')}
        placeholder={tLinks('searchPlaceholder')}
        search={search}
        onSearchChange={setSearch}
        results={results}
        loading={students.isPending}
        selected={selected}
        onToggle={(id) =>
          setSelected((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
        listLabel={tLinks('listLabel')}
        emptyTitle={tLinks('noResultsTitle')}
        emptyHint={tLinks('noResultsHint')}
        chooseText={tLinks('choose')}
        selectedText={(count) => tLinks('selected', { count })}
        createLabel={t('createStudent')}
        onCreate={() => setCreateOpen(true)}
        confirmLabel={
          mobile
            ? tLinks('doneCount', { count: selected.length })
            : tLinks('linkCount', { count: selected.length })
        }
        cancelLabel={tCommon('cancel')}
        closeLabel={tLinks('close')}
        busy={links.busy}
        onConfirm={(ids) =>
          void links.link(ids).then((saved) => {
            report(saved, tLinks('saved'));
            if (saved) closePicker();
          })
        }
      />

      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(open) => (open || links.busy ? undefined : setUnlinking(null))}
        tone="neutral"
        title={t('unlinkTitle')}
        description={t('unlinkText', { name: unlinking?.name ?? '' })}
        confirmLabel={tLinks('unlink')}
        pending={links.busy}
        onConfirm={() => {
          if (!unlinking) return;
          void links.unlink(unlinking.id).then((saved) => {
            report(saved, tLinks('unlinked'));
            setUnlinking(null);
          });
        }}
      />

      <StudentQuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        navigateOnSuccess={false}
        onSuccess={(student) => {
          closePicker();
          void links.link([student.id]).then((saved) => report(saved, tLinks('saved')));
        }}
      />

      <LessonFormDialog
        open={scheduleFor !== null}
        onOpenChange={(open) => (open ? undefined : setScheduleFor(null))}
        lockedStudentId={scheduleFor ?? undefined}
      />
    </>
  );
}
