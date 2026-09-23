'use client';

import { useCallback, useMemo, type Ref } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PencilIcon, PhoneIcon, UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { useParentLinkResults, useParentLinkRow } from '@/features/parents';
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
import { useUpdateStudentMutation } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';

const ADD_ID = 'student-link-parent';

/**
 * The family block — the student's side of the relationship whose parent
 * side is the parent profile's linked-students card. Both run on
 * `useRelationshipLinks` and render one `LinkedCard` with one
 * `LinkPickerDialog`. "Create a new contact" opens the parent form with this
 * student already linked. An archived student keeps the rows and the view
 * actions and loses every command that changes the links.
 */
export function StudentParentsCard({
  student,
  readOnly = false,
  sectionRef,
}: {
  student: StudentDetail;
  readOnly?: boolean;
  sectionRef?: Ref<HTMLDivElement>;
}) {
  const t = useTranslations('students.parents');
  const tLinks = useTranslations('links');
  const tErrors = useTranslations('errors');
  const mobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: queryKeys.students.detail(student.id) }) > 0;
  const { mutateAsync: updateStudent } = useUpdateStudentMutation(student.id);
  const toRow = useParentLinkRow();

  const serverRows = useMemo(() => student.parents.map(toRow), [student.parents, toRow]);
  const phoneById = useMemo(
    () => new Map(student.parents.map((parent) => [parent.id, parent.phone])),
    [student.parents],
  );
  const save = useCallback((parentIds: string[]) => updateStudent({ parentIds }), [updateStudent]);
  const refetch = useCallback(
    // Joins the read the save's invalidation already started instead of
    // cancelling it and sending a second one.
    () =>
      queryClient.refetchQueries(
        { queryKey: queryKeys.students.detail(student.id) },
        { cancelRefetch: false },
      ),
    [queryClient, student.id],
  );
  const flow = useRelationshipLinks({ serverRows, save, refetch, refreshing });
  const { results, loading } = useParentLinkResults({
    ...flow.search,
    enabled: flow.search.enabled && !readOnly,
    exclude: flow.links.linkedIds,
  });
  const addButton = () => document.getElementById(ADD_ID);

  const items = flow.rows.map((row) => {
    const phone = phoneById.get(row.id);
    return {
      ...row,
      href: `/app/parents/${row.id}`,
      hrefLabel: tLinks('openProfileOf', { name: row.name }),
      menu: (
        <DropdownMenu>
          <RowActionsTrigger
            label={tLinks('rowActions', { name: row.name })}
            className="md:size-8"
          />
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link prefetch={false} href={`/app/parents/${row.id}`}>
                  <UserIcon data-icon />
                  {tLinks('openProfile')}
                </Link>
              </DropdownMenuItem>
              {phone ? (
                <DropdownMenuItem asChild>
                  <a href={`tel:${phone}`}>
                    <PhoneIcon data-icon />
                    {t('call')}
                  </a>
                </DropdownMenuItem>
              ) : null}
              {!readOnly ? (
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href={`/app/parents/${row.id}/edit`}>
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
                    disabled={flow.busy}
                    onSelect={() => flow.requestUnlink(row)}
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
    };
  });

  return (
    <>
      <div ref={sectionRef}>
        <LinkedCard
          title={t('title')}
          items={items}
          addLabel={readOnly ? undefined : tLinks('link')}
          addId={ADD_ID}
          onAdd={flow.openPicker}
          addDisabled={flow.busy}
          emptyText={readOnly ? t('emptyArchived') : t('empty')}
          avatarTint="warning"
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
      </div>

      {!readOnly ? (
        <>
          <LinkPickerDialog
            {...flow.pickerProps(results)}
            loading={loading}
            title={t('pickerTitle')}
            subtitle={student.fullName}
            createLabel={t('createContact')}
            onCreate={() => router.push(`/app/parents/new?studentId=${student.id}`)}
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
      ) : null}
    </>
  );
}
