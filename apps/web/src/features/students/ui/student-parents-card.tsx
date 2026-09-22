'use client';

import { useMemo, useState, type Ref } from 'react';
import Link from 'next/link';
import { PhoneIcon, PlusIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem, StudentDetail } from '@tutorio/validation';
import { ParentFormDialog } from '@/components/parents/parent-form-dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { EntityPicker } from '@/components/shared/entity-picker';
import { InfoCard } from '@/components/shared/info-card';
import { PersonItem } from '@/components/shared/person-item';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessageKey } from '@/lib/api/error-message';
import { useParentsQuery } from '@/lib/api/parents';
import { useUpdateStudentMutation } from '@/lib/api/students';

/**
 * The family block: each parent as a person row with their contact one tap
 * away, plus the two ways to add one — link an existing contact, or create a
 * new one from the card's own action.
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
  const tErrors = useTranslations('errors');
  const parents = useParentsQuery({ page: 1, pageSize: 100 }, !readOnly);
  const update = useUpdateStudentMutation(student.id);
  const [extraParents, setExtraParents] = useState<ParentListItem[]>([]);
  const [retryParentIds, setRetryParentIds] = useState<string[] | null>(null);
  const linkedIds = student.parents.map((parent) => parent.id);
  const available = useMemo(() => {
    const byId = new Map<string, ParentListItem>();
    for (const parent of [...(parents.data?.items ?? []), ...extraParents])
      byId.set(parent.id, parent);
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
    const selectable: ParentListItem = {
      id: parent.id,
      fullName: parent.fullName,
      phone: null,
      telegramUsername: null,
      avatarKey: null,
      deletedAt: null,
      students: [],
    };
    setExtraParents((current) =>
      current.some((item) => item.id === parent.id) ? current : [...current, selectable],
    );
    await saveLinks([...linkedIds, parent.id]);
  };

  return (
    <>
      <div ref={sectionRef}>
        <InfoCard
          title={t('title')}
          action={
            !readOnly ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="px-0"
                onClick={() => onCreateOpenChange(true)}
              >
                <PlusIcon data-icon="inline-start" />
                {t('create')}
              </Button>
            ) : undefined
          }
        >
          {update.error && retryParentIds ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{tErrors(errorMessageKey(update.error))}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveLinks(retryParentIds)}
                >
                  {t('retryLink')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {student.parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {readOnly ? t('emptyArchived') : t('empty')}
            </p>
          ) : (
            student.parents.map((parent) => (
              <PersonItem
                key={parent.id}
                media={
                  <EntityAvatar
                    avatarKey={parent.avatarKey}
                    fullName={parent.fullName}
                    tint="warning"
                  />
                }
                name={
                  <Link href={`/app/parents/${parent.id}`} className="hover:underline">
                    {parent.fullName}
                  </Link>
                }
                subtitle={parent.phone ?? parent.telegramUsername ?? undefined}
                // Both controls go in the action slot: `trail` is decorative
                // and hidden from assistive tech, so a button cannot live there.
                action={
                  <>
                    {parent.phone ? (
                      <Button
                        asChild
                        variant="white"
                        size="icon-md"
                        aria-label={t('call', { name: parent.fullName })}
                      >
                        <a href={`tel:${parent.phone}`}>
                          <PhoneIcon />
                        </a>
                      </Button>
                    ) : null}
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('unlink', { name: parent.fullName })}
                        onClick={() => void saveLinks(linkedIds.filter((id) => id !== parent.id))}
                      >
                        <XIcon />
                      </Button>
                    ) : null}
                  </>
                }
              />
            ))
          )}

          {!readOnly ? (
            parents.isError ? (
              <QueryErrorAlert title={t('loadError')} onRetry={() => void parents.refetch()} />
            ) : (
              <EntityPicker
                id="student-link-parent"
                aria-label={t('link')}
                options={available.map((parent) => ({
                  value: parent.id,
                  label: parent.fullName,
                  avatarKey: parent.avatarKey,
                }))}
                onChange={(parentId) => (parentId ? void saveLinks([...linkedIds, parentId]) : undefined)}
                placeholder={t('link')}
                searchPlaceholder={t('search')}
                emptyLabel={t('noResults')}
                disabled={parents.isPending || update.isPending}
                isLoading={parents.isPending}
              />
            )
          ) : null}
        </InfoCard>
      </div>
      {!readOnly ? (
        <ParentFormDialog
          open={createOpen}
          onOpenChange={onCreateOpenChange}
          onSuccess={(parent) => void created(parent)}
          hideStudentLinks
        />
      ) : null}
    </>
  );
}
