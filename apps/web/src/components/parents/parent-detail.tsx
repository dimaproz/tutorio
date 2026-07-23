'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpenIcon,
  PencilIcon,
  PhoneIcon,
  SendIcon,
  Trash2Icon,
  UsersRoundIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BackButton } from '@/components/app/back-button';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { PersonMiniCard } from '@/components/app/person-mini-card';
import { InfoRow, ProfileHeader, SectionTitle } from '@/components/app/detail-view';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteParentMutation, useParentQuery } from '@/lib/api/parents';
import type { GatewayError } from '@/lib/auth/client';
import { ParentFormDialog } from './parent-form-dialog';

export function ParentDetailView({ parentId }: { parentId: string }) {
  const t = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const parent = useParentQuery(parentId);
  const deleteParent = useDeleteParentMutation();

  if (parent.isPending) {
    return <ListSkeleton rows={5} />;
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

  const addedOn = t('detail.addedOn', {
    date: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(data.createdAt)),
  });

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

  return (
    <>
      {/* Top bar: back link + primary actions. */}
      <div className="flex items-center justify-between gap-3">
        <BackButton href="/app/parents" />
        <div className="flex flex-wrap gap-2">
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

      {/* Profile header — sits on the page background, no card. */}
      <ProfileHeader avatarKey={data.avatarKey} fullName={data.fullName} subtitle={addedOn} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column. */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <SectionTitle icon={BookOpenIcon} tone="rose">{t('detail.notesTitle')}</SectionTitle>
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

        {/* Right column. */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle icon={PhoneIcon} tone="sky">{t('detail.contactsTitle')}</SectionTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <InfoRow
                icon={PhoneIcon}
                label={t('form.phone')}
                href={data.phone ? `tel:${data.phone}` : undefined}
              >
                {data.phone ?? (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
              <InfoRow
                icon={SendIcon}
                label={t('form.telegramUsername')}
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
              <SectionTitle icon={UsersRoundIcon} tone="amber">
                {t('detail.studentsTitle')}
              </SectionTitle>
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
                    <li key={student.id}>
                      <PersonMiniCard
                        avatarKey={student.avatarKey}
                        fullName={student.fullName}
                        href={`/app/students/${student.id}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
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
        pending={deleteParent.isPending}
      />

      <ParentFormDialog open={editOpen} onOpenChange={setEditOpen} parentId={data.id} />
    </>
  );
}
