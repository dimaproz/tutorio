'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { EnrollmentResponse, StudentEnrollmentSummary } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ListSkeleton, PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import {
  BillingTypeBadge,
  DeletedBadge,
  EnrollmentStatusBadge,
} from '@/components/app/status-badges';
import { EnrollmentSheet } from '@/components/enrollments/enrollment-sheet';
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
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { useEnrollmentsQuery } from '@/lib/api/enrollments';
import {
  useDeleteStudentMutation,
  useRestoreStudentMutation,
  useStudentQuery,
} from '@/lib/api/students';
import { useSession } from '@/components/app/session-provider';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentDetailView({ studentId }: { studentId: string }) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EnrollmentResponse | undefined>();

  const student = useStudentQuery(studentId);
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  // Full enrollment records power the editor; the detail payload only carries
  // display summaries.
  const enrollments = useEnrollmentsQuery({ page: 1, studentId });
  const deleteStudent = useDeleteStudentMutation();
  const restoreStudent = useRestoreStudentMutation();

  if (student.isPending) {
    return <ListSkeleton rows={4} />;
  }

  if (student.isError) {
    return (
      <QueryErrorAlert
        error={student.error}
        title={t('error.title')}
        onRetry={() => void student.refetch()}
      />
    );
  }

  const data = student.data;
  const isDeleted = Boolean(data.deletedAt);
  const hasContacts = Boolean(data.email ?? data.phone);
  const hasParent = Boolean(data.parentName ?? data.parentEmail ?? data.parentPhone);

  function openCreate() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(summary: StudentEnrollmentSummary) {
    setEditing(enrollments.data?.items.find((item) => item.id === summary.id));
    setSheetOpen(true);
  }

  async function onDelete() {
    try {
      await deleteStudent.mutateAsync(studentId);
      toast.success(t('toasts.deleted'));
      setDeleteOpen(false);
      router.push('/app/students');
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onRestore() {
    try {
      await restoreStudent.mutateAsync(studentId);
      toast.success(t('toasts.restored'));
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <>
      <PageHeader
        title={data.fullName}
        description={data.timezone}
        action={
          isDeleted ? (
            isOwner ? (
              <Button type="button" onClick={() => void onRestore()} disabled={restoreStudent.isPending}>
                {tCommon('restore')}
              </Button>
            ) : null
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href={`/app/students/${data.id}/edit`}>
                  <PencilIcon data-icon="inline-start" />
                  {tCommon('edit')}
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2Icon data-icon="inline-start" />
                {tCommon('delete')}
              </Button>
              <Button type="button" onClick={openCreate}>
                <PlusIcon data-icon="inline-start" />
                {t('detail.addEnrollment')}
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
        {hasContacts ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.contactsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                {data.email ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">{t('form.email')}</dt>
                    <dd>
                      <a className="underline underline-offset-4" href={`mailto:${data.email}`}>
                        {data.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
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
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {hasParent ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.parentTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                {data.parentName ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">{t('form.parentName')}</dt>
                    <dd>{data.parentName}</dd>
                  </div>
                ) : null}
                {data.parentEmail ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">{t('form.parentEmail')}</dt>
                    <dd>
                      <a
                        className="underline underline-offset-4"
                        href={`mailto:${data.parentEmail}`}
                      >
                        {data.parentEmail}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {data.parentPhone ? (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">{t('form.parentPhone')}</dt>
                    <dd>
                      <a className="underline underline-offset-4" href={`tel:${data.parentPhone}`}>
                        {data.parentPhone}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {data.notes ? (
          <Card className="lg:col-span-2">
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
          <CardTitle>{t('detail.enrollmentsTitle')}</CardTitle>
          <CardDescription>{t('detail.enrollmentsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.enrollments.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t('detail.noEnrollments')}</EmptyTitle>
                <EmptyDescription>{t('detail.noEnrollmentsDescription')}</EmptyDescription>
              </EmptyHeader>
              {!isDeleted ? (
                <EmptyContent>
                  <Button type="button" onClick={openCreate}>
                    <PlusIcon data-icon="inline-start" />
                    {t('detail.addEnrollment')}
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
                      <span className="font-medium">
                        {enrollment.group?.name ?? t('detail.individual')}
                      </span>
                      <EnrollmentStatusBadge status={enrollment.status} />
                      <BillingTypeBadge billingType={enrollment.billingType} />
                    </div>
                    <p className="tabular text-muted-foreground text-sm">
                      {`${t('detail.teacher')}: ${enrollment.teacher.name} · ${t('detail.price')}: ${formatMoneyDisplay(
                        enrollment.priceMinor,
                        enrollment.currency,
                        locale,
                      )} · ${t('detail.deadline')}: ${t('detail.deadlineHours', {
                        hours: enrollment.effectiveCancellationDeadlineHours,
                      })}`}
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
        description={t('deleteDialog.description', { name: data.fullName })}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deleteStudent.isPending}
      />

      <EnrollmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        enrollment={editing}
        lockedStudentId={data.id}
      />
    </>
  );
}
