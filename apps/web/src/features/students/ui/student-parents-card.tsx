'use client';

import { useMemo, useState, type Ref } from 'react';
import { PlusIcon, UsersRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem, StudentDetail } from '@tutorio/validation';
import { ParentFormDialog } from '@/components/parents/parent-form-dialog';
import { EntityPicker } from '@/components/shared/entity-picker';
import { PersonMiniCard } from '@/components/shared/person-mini-card';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { SectionTitle } from '@/components/shared/detail-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { errorMessageKey } from '@/lib/api/error-message';
import { useParentsQuery } from '@/lib/api/parents';
import { useUpdateStudentMutation } from '@/lib/api/students';

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
  const tErrors = useTranslations('errors');
  const parents = useParentsQuery({ page: 1, pageSize: 100 }, !readOnly);
  const update = useUpdateStudentMutation(student.id);
  const [extraParents, setExtraParents] = useState<ParentListItem[]>([]);
  const [retryParentIds, setRetryParentIds] = useState<string[] | null>(null);
  const linkedIds = student.parents.map((parent) => parent.id);
  const available = useMemo(() => {
    const byId = new Map<string, ParentListItem>();
    for (const parent of [...(parents.data?.items ?? []), ...extraParents]) byId.set(parent.id, parent);
    return [...byId.values()].filter((parent) => !linkedIds.includes(parent.id));
  }, [parents.data, extraParents, linkedIds]);

  const saveLinks = async (parentIds: string[]) => {
    setRetryParentIds(null);
    try {
      await update.mutateAsync({ parentIds });
    } catch {
      setRetryParentIds(parentIds);
    }
  };

  const created = async (parent: { id: string; fullName: string }) => {
    const selectable: ParentListItem = { id: parent.id, fullName: parent.fullName, phone: null, telegramUsername: null, avatarKey: null, deletedAt: null, students: [] };
    setExtraParents((current) => current.some((item) => item.id === parent.id) ? current : [...current, selectable]);
    await saveLinks([...linkedIds, parent.id]);
  };

  return <><Card ref={sectionRef}><CardHeader><SectionTitle icon={UsersRoundIcon}>{t('title')}</SectionTitle>{!readOnly ? <CardAction><Button type="button" variant="outline" size="sm" onClick={() => onCreateOpenChange(true)}><PlusIcon data-icon="inline-start" />{t('create')}</Button></CardAction> : null}</CardHeader><CardContent className="flex flex-col gap-3">
    {update.error && retryParentIds ? <Alert variant="destructive" role="alert"><AlertDescription className="flex flex-col items-start gap-2"><span>{tErrors(errorMessageKey(update.error))}</span><Button type="button" variant="outline" size="sm" onClick={() => void saveLinks(retryParentIds)}>{t('retryLink')}</Button></AlertDescription></Alert> : null}
    {student.parents.length === 0 ? <p className="text-sm text-muted-foreground">{readOnly ? t('emptyArchived') : t('empty')}</p> : <ul className="flex flex-col gap-2">{student.parents.map((parent) => <li key={parent.id}><PersonMiniCard avatarKey={parent.avatarKey} fullName={parent.fullName} subtitle={parent.phone ?? parent.telegramUsername} href={readOnly ? `/app/parents/${parent.id}` : undefined} onRemove={readOnly ? undefined : () => void saveLinks(linkedIds.filter((id) => id !== parent.id))} removeLabel={t('unlink', { name: parent.fullName })} /></li>)}</ul>}
    {!readOnly ? parents.isError ? <QueryErrorAlert title={t('loadError')} onRetry={() => void parents.refetch()} /> : <EntityPicker id="student-link-parent" aria-label={t('link')} options={available.map((parent) => ({ value: parent.id, label: parent.fullName, avatarKey: parent.avatarKey }))} onChange={(parentId) => parentId ? void saveLinks([...linkedIds, parentId]) : undefined} placeholder={t('link')} searchPlaceholder={t('search')} emptyLabel={t('noResults')} disabled={parents.isPending || update.isPending} isLoading={parents.isPending} /> : null}
  </CardContent></Card>{!readOnly ? <ParentFormDialog open={createOpen} onOpenChange={onCreateOpenChange} onSuccess={(parent) => void created(parent)} hideStudentLinks /> : null}</>;
}
