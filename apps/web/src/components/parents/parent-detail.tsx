'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { DeletedBadge } from '@/components/app/status-badges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useDeleteParentMutation,
  useParentQuery,
  useRestoreParentMutation,
} from '@/lib/api/parents';
import type { GatewayError } from '@/lib/auth/client';
import { useSession } from '@/components/app/session-provider';
import { ParentFormDialog } from './parent-form-dialog';

export function ParentDetailView({ parentId }: { parentId: string }) {
  const t = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const parent = useParentQuery(parentId);
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const deleteParent = useDeleteParentMutation();
  const restoreParent = useRestoreParentMutation();

  if (parent.isPending) {
    return <ListSkeleton rows={4} />;
  }

  if (parent.isError) {
    return (
      <QueryErrorAlert
        error={parent.error}
        title={t('error.title')}
        onRetry={() => void parent.refetch()}
      />
    );
  }

  const data = parent.data;
  const isDeleted = Boolean(data.deletedAt);

  async function onDelete() {
    try {
      await deleteParent.mutateAsync(parentId);
      toast.success(t('toasts.deleted'));
      setDeleteOpen(false);
      router.push('/app/parents');
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onRestore() {
    try {
      await restoreParent.mutateAsync(parentId);
      toast.success(t('toasts.restored'));
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <>
      <PageHeader
        title={data.fullName}
        description={data.phone ?? undefined}
        action={
          isDeleted ? (
            isOwner ? (
              <Button
                type="button"
                onClick={() => void onRestore()}
                disabled={restoreParent.isPending}
              >
                {tCommon('restore')}
              </Button>
            ) : null
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" />
                {tCommon('edit')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2Icon data-icon="inline-start" />
                {tCommon('delete')}
              </Button>
            </div>
          )
        }
      />

      {isDeleted ? (
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <DeletedBadge label={tCommon('deleted')} />
            {t('detail.deletedTitle')}
          </AlertTitle>
          <AlertDescription>{t('detail.deletedDescription')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.contactsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              {data.phone ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{t('form.phone')}</dt>
                  <dd>
                    <a className="underline underline-offset-4" href={`tel:${data.phone}`}>
                      {data.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {data.telegramUsername ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{t('form.telegramUsername')}</dt>
                  <dd>@{data.telegramUsername.replace(/^@/, '')}</dd>
                </div>
              ) : null}
              {!data.phone && !data.telegramUsername ? (
                <span className="text-muted-foreground">{tCommon('notProvided')}</span>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {data.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.notesTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('detail.studentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.students.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t('detail.noStudents')}</EmptyTitle>
                <EmptyDescription>{t('detail.noStudentsDescription')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.students.map((student) => (
                <li key={student.id} className="rounded-lg border p-3">
                  <Link
                    href={`/app/students/${student.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {student.fullName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: data.fullName })}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deleteParent.isPending}
      />

      <ParentFormDialog open={editOpen} onOpenChange={setEditOpen} parentId={data.id} />
    </>
  );
}
