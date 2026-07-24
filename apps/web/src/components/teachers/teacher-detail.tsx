'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BanknoteIcon,
  BookOpenIcon,
  MailIcon,
  NotebookPenIcon,
  PencilIcon,
  PhoneIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BackButton } from '@/components/app/back-button';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { InfoRow, ProfileHeader, ProfileTag, SectionTitle } from '@/components/app/detail-view';
import { ListSkeleton, QueryErrorAlert, QueryRefreshIndicator } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteTeacherMutation, useTeacherQuery } from '@/lib/api/teachers';
import type { GatewayError } from '@/lib/auth/client';
import { formatMoneyDisplay } from '@/lib/money';
import { TeacherFormDialog } from './teacher-form-dialog';
import { TeacherStatusBadge } from './teacher-status-badge';

export function TeacherDetail({ teacherId }: { teacherId: string }) {
  const t = useTranslations('teachers');
  const tDetail = useTranslations('teachers.detail');
  const tForm = useTranslations('teachers.form');
  const tSubject = useTranslations('subject');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const teacher = useTeacherQuery(teacherId);
  const deleteTeacher = useDeleteTeacherMutation();

  if (teacher.isPending) {
    return <ListSkeleton rows={5} />;
  }
  if (teacher.isError) {
    return (
      <QueryErrorAlert
        error={teacher.error}
        title={t('error.title')}
        onRetry={() => void teacher.refetch()}
      />
    );
  }

  const data = teacher.data;
  const addedOn = tDetail('addedOn', {
    date: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(data.createdAt)),
  });

  async function onDelete() {
    try {
      await deleteTeacher.mutateAsync(teacherId);
      toast.success(t('toasts.deleted'));
      setDeleteOpen(false);
      router.push('/app/teachers');
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <BackButton href="/app/teachers" />
        <div className="flex flex-wrap gap-2">
          <QueryRefreshIndicator isFetching={teacher.isFetching && !teacher.isPending} />
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            {tCommon('edit')}
          </Button>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon data-icon="inline-start" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <ProfileHeader
        avatarKey={data.avatarKey}
        fullName={data.fullName}
        subtitle={addedOn}
        badge={<TeacherStatusBadge status={data.status} />}
        tags={data.subjects.map((subject) => (
          <ProfileTag key={subject} icon={BookOpenIcon}>
            {tSubject(subject)}
          </ProfileTag>
        ))}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <SectionTitle icon={BookOpenIcon} tone="destructive">
                {tDetail('bioTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {data.bio ? (
                <p className="text-sm whitespace-pre-wrap">{data.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{tCommon('notProvided')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={NotebookPenIcon} tone="warning">
                {tDetail('notesTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {data.notes ? (
                <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{tCommon('notProvided')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle icon={PhoneIcon} tone="primary">
                {tDetail('contactsTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <InfoRow
                icon={MailIcon}
                label={tForm('email')}
                href={data.email ? `mailto:${data.email}` : undefined}
              >
                {data.email ?? (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
              <InfoRow
                icon={PhoneIcon}
                label={tForm('phone')}
                href={data.phone ? `tel:${data.phone}` : undefined}
              >
                {data.phone ?? (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
              <InfoRow
                icon={SendIcon}
                label={tForm('telegramUsername')}
                href={
                  data.telegramUsername
                    ? `https://t.me/${data.telegramUsername.replace(/^@/, '')}`
                    : undefined
                }
                external={Boolean(data.telegramUsername)}
              >
                {data.telegramUsername ? (
                  `@${data.telegramUsername.replace(/^@/, '')}`
                ) : (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={BanknoteIcon} tone="success">
                {tDetail('teachingTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <InfoRow icon={BanknoteIcon} label={tDetail('rate')}>
                {data.defaultRateMinor != null ? (
                  formatMoneyDisplay(data.defaultRateMinor, data.currency ?? 'EUR', locale)
                ) : (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: data.fullName })}
        confirmLabel={t('deleteDialog.confirm')}
        onConfirm={() => void onDelete()}
        pending={deleteTeacher.isPending}
      />

      <TeacherFormDialog open={editOpen} onOpenChange={setEditOpen} teacherId={data.id} />
    </>
  );
}
