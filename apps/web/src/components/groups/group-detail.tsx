'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { EnrollmentResponse, GroupEnrollmentSummary } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import {
  BillingTypeBadge,
  DeletedBadge,
  EnrollmentStatusBadge,
} from '@/components/app/status-badges';
import { EnrollmentDialog } from '@/components/enrollments/enrollment-dialog';
import { GroupFormDialog } from './group-form-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useEnrollmentsQuery } from '@/lib/api/enrollments';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useDeleteGroupMutation,
  useGroupQuery,
  useRestoreGroupMutation,
} from '@/lib/api/groups';
import type { GatewayError } from '@/lib/auth/client';
import { formatMoneyDisplay } from '@/lib/money';

export function GroupDetailView({ groupId }: { groupId: string }) {
  const t = useTranslations('groups');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EnrollmentResponse | undefined>();

  const group = useGroupQuery(groupId);
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const enrollments = useEnrollmentsQuery({ page: 1, groupId });
  const deleteGroup = useDeleteGroupMutation();
  const restoreGroup = useRestoreGroupMutation();

  if (group.isPending) {
    return <ListSkeleton rows={4} />;
  }

  if (group.isError) {
    return (
      <QueryErrorAlert
        error={group.error}
        title={t('error.title')}
        onRetry={() => void group.refetch()}
      />
    );
  }

  const data = group.data;
  const isDeleted = Boolean(data.deletedAt);

  function openCreate() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(summary: GroupEnrollmentSummary) {
    setEditing(enrollments.data?.items.find((item) => item.id === summary.id));
    setSheetOpen(true);
  }

  async function onDelete() {
    try {
      await deleteGroup.mutateAsync(groupId);
      toast.success(t('toasts.deleted'));
      setDeleteOpen(false);
      router.push('/app/groups');
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onRestore() {
    try {
      await restoreGroup.mutateAsync(groupId);
      toast.success(t('toasts.restored'));
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <>
      <PageHeader
        title={data.name}
        description={t('studentCount', {
          count: data.enrollments.filter((item) => item.status === 'ACTIVE').length,
        })}
        action={
          isDeleted ? (
            isOwner ? (
              <Button
                type="button"
                onClick={() => void onRestore()}
                disabled={restoreGroup.isPending}
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
              <Button type="button" onClick={openCreate}>
                <PlusIcon data-icon="inline-start" />
                {t('detail.addStudent')}
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

      {data.pricePerLesson != null && data.currency ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.priceTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-sm">
              {formatMoneyDisplay(data.pricePerLesson, data.currency, locale)}
            </p>
          </CardContent>
        </Card>
      ) : null}

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

      <Card>
        <CardHeader>
          <CardTitle>{t('detail.membersTitle')}</CardTitle>
          <CardDescription>{t('detail.membersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.enrollments.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t('detail.noMembers')}</EmptyTitle>
                <EmptyDescription>{t('detail.noMembersDescription')}</EmptyDescription>
              </EmptyHeader>
              {!isDeleted ? (
                <EmptyContent>
                  <Button type="button" onClick={openCreate}>
                    <PlusIcon data-icon="inline-start" />
                    {t('detail.addStudent')}
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.enrollments.map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/students/${enrollment.student.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {enrollment.student.fullName}
                      </Link>
                      <EnrollmentStatusBadge status={enrollment.status} />
                      <BillingTypeBadge billingType={enrollment.billingType} />
                    </div>
                    <p className="tabular text-muted-foreground text-sm">
                      {`${t('detail.teacher')}: ${enrollment.teacher.name} · ${t('detail.price')}: ${formatMoneyDisplay(
                        enrollment.priceMinor,
                        enrollment.currency,
                        locale,
                      )}`}
                    </p>
                  </div>
                  {!isDeleted ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(enrollment)}
                      disabled={enrollments.isPending}
                    >
                      {tCommon('edit')}
                    </Button>
                  ) : null}
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
        description={t('deleteDialog.description', { name: data.name })}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deleteGroup.isPending}
      />

      <EnrollmentDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        enrollment={editing}
        lockedGroupId={data.id}
      />

      <GroupFormDialog open={editOpen} onOpenChange={setEditOpen} groupId={data.id} />
    </>
  );
}
