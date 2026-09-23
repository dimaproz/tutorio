'use client';

import { useCallback, useMemo, useState, type Ref } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PencilIcon, PhoneIcon, UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
// Parents imports this feature back (the student quick create); the cycle is
// harmless because both sides use each other only inside JSX.
import { ParentQuickCreateDialog } from '@/features/parents';
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
import { useLinkedSet } from '@/hooks/use-linked-set';
import { errorMessageKey } from '@/lib/api/error-message';
import { queryKeys } from '@/lib/api/keys';
import { useParentsQuery } from '@/lib/api/parents';
import { useUpdateStudentMutation } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';

function contactLine(parent: { phone: string | null; telegramUsername: string | null }) {
  const telegram = parent.telegramUsername?.replace(/^@+/, '');
  return parent.phone ?? (telegram ? `@${telegram}` : undefined);
}

/**
 * The family block — the student's side of the relationship whose parent
 * side is the parent profile's linked-students card. Both are one
 * `LinkedCard` with one `LinkPickerDialog`, and both save the whole set
 * through `useLinkedSet`, so two quick edits never undo each other. Creating
 * a contact happens only on a saved student and links it straight after.
 */
export function StudentParentsCard({
  student,
  createOpen,
  onCreateOpenChange,
  readOnly = false,
  sectionRef,
}: {
  student: StudentDetail;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  sectionRef?: Ref<HTMLDivElement>;
}) {
  const t = useTranslations('students.parents');
  const tLinks = useTranslations('links');
  const tParents = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const mobile = useIsMobile();
  const queryClient = useQueryClient();
  const { mutateAsync: updateStudent } = useUpdateStudentMutation(student.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [unlinking, setUnlinking] = useState<{ id: string; name: string } | null>(null);

  const serverIds = useMemo(() => student.parents.map((parent) => parent.id), [student.parents]);
  const save = useCallback((parentIds: string[]) => updateStudent({ parentIds }), [updateStudent]);
  const confirm = useCallback(async () => {
    const key = queryKeys.students.detail(student.id);
    await queryClient.refetchQueries({ queryKey: key });
    return queryClient.getQueryState(key)?.status === 'success';
  }, [student.id, queryClient]);
  const links = useLinkedSet({ serverIds, save, confirm });

  const parents = useParentsQuery(
    { page: 1, pageSize: 20, search: search.trim() || undefined },
    pickerOpen && !readOnly,
  );
  const results = (parents.data?.items ?? [])
    .filter((parent) => !links.linkedIds.includes(parent.id))
    .map((parent) => ({
      id: parent.id,
      name: parent.fullName,
      avatarKey: parent.avatarKey,
      meta: [
        contactLine(parent),
        parent.students.length > 0
          ? tParents('roleLine', {
              names: parent.students.map((child) => child.fullName.split(' ')[0]).join(', '),
            })
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }));

  const closePicker = () => {
    setPickerOpen(false);
    setSearch('');
    setSelected([]);
  };
  const report = (saved: boolean, message: string) =>
    saved ? toast.success(message) : toast.error(tLinks('saveError'));

  const items = student.parents.map((parent) => ({
    id: parent.id,
    name: parent.fullName,
    avatarKey: parent.avatarKey,
    meta: contactLine(parent),
    href: `/app/parents/${parent.id}`,
    hrefLabel: tLinks('openProfileOf', { name: parent.fullName }),
    menu: (
      <DropdownMenu>
        <RowActionsTrigger
          label={tLinks('rowActions', { name: parent.fullName })}
          className="md:size-8"
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/app/parents/${parent.id}`}>
                <UserIcon data-icon />
                {tLinks('openProfile')}
              </Link>
            </DropdownMenuItem>
            {parent.phone ? (
              <DropdownMenuItem asChild>
                <a href={`tel:${parent.phone}`}>
                  <PhoneIcon data-icon />
                  {t('call')}
                </a>
              </DropdownMenuItem>
            ) : null}
            {!readOnly ? (
              <DropdownMenuItem asChild>
                <Link href={`/app/parents/${parent.id}/edit`}>
                  <PencilIcon data-icon />
                  {t('editContact')}
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {!readOnly ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={links.busy}
                  onSelect={() => setUnlinking({ id: parent.id, name: parent.fullName })}
                >
                  <XIcon data-icon />
                  {t('unlink')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }));

  return (
    <>
      <div ref={sectionRef}>
        <LinkedCard
          title={t('title')}
          items={items}
          addLabel={readOnly ? undefined : tLinks('link')}
          addId="student-link-parent"
          onAdd={() => setPickerOpen(true)}
          addDisabled={links.busy}
          emptyText={readOnly ? t('emptyArchived') : t('empty')}
          avatarTint="warning"
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
      </div>

      {!readOnly ? (
        <>
          <LinkPickerDialog
            open={pickerOpen}
            onOpenChange={(open) => (open ? setPickerOpen(true) : closePicker())}
            title={t('pickerTitle')}
            subtitle={student.fullName}
            searchLabel={tLinks('searchLabel')}
            placeholder={tLinks('searchPlaceholder')}
            search={search}
            onSearchChange={setSearch}
            results={results}
            loading={parents.isPending}
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
            createLabel={t('createContact')}
            onCreate={() => onCreateOpenChange(true)}
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

          <ParentQuickCreateDialog
            open={createOpen}
            onOpenChange={onCreateOpenChange}
            onSuccess={(parent) => {
              closePicker();
              void links.link([parent.id]).then((saved) => report(saved, tLinks('saved')));
            }}
          />
        </>
      ) : null}
    </>
  );
}
