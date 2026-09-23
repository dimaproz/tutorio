'use client';

import { useMemo, useState, type ReactNode, type Ref } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PhoneIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem, StudentDetail } from '@tutorio/validation';
// Direct import until Parents migrates in Work Packet 6.1: its barrel does not
// export the dialog yet. The parent form imports this feature back, a cycle
// that is harmless because both sides use each other only inside JSX.
import { ParentFormDialog } from '@/components/parents/parent-form-dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { EntityPicker } from '@/components/shared/entity-picker';
import { InfoCard } from '@/components/shared/info-card';
import { PersonItem } from '@/components/shared/person-item';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessageKey } from '@/lib/api/error-message';
import { queryKeys } from '@/lib/api/keys';
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
  const queryClient = useQueryClient();
  // Each save sends the whole parent set, so the next one must start from what
  // was last sent, not from a profile that has not refetched yet — otherwise
  // two quick edits undo each other. Controls stay disabled from the send
  // until the refreshed profile has arrived.
  const serverIds = useMemo(() => student.parents.map((parent) => parent.id), [student.parents]);
  const [sentIds, setSentIds] = useState<string[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const linkedIds = sentIds ?? serverIds;
  const busy = update.isPending || refreshing;
  const available = useMemo(() => {
    const byId = new Map<string, ParentListItem>();
    for (const parent of [...(parents.data?.items ?? []), ...extraParents])
      byId.set(parent.id, parent);
    return [...byId.values()].filter((parent) => !linkedIds.includes(parent.id));
  }, [parents.data, extraParents, linkedIds]);

  const saveLinks = async (parentIds: string[]) => {
    setRetryParentIds(null);
    setSentIds(parentIds);
    setRefreshing(true);
    try {
      await update.mutateAsync({ parentIds });
    } catch {
      setSentIds(null);
      setRetryParentIds(parentIds);
      setRefreshing(false);
      return;
    }
    // The save succeeded. The sent set stays authoritative until a refreshed
    // profile confirms it; a failed refresh must not hand the next edit a
    // stale set to build on.
    const key = queryKeys.students.detail(student.id);
    await queryClient.refetchQueries({ queryKey: key });
    if (queryClient.getQueryState(key)?.status === 'success') setSentIds(null);
    setRefreshing(false);
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

  const picker = (trigger: ReactNode) => (
    <EntityPicker
      id="student-link-parent"
      aria-label={t('link')}
      trigger={trigger}
      options={available.map((parent) => ({
        value: parent.id,
        label: parent.fullName,
        avatarKey: parent.avatarKey,
      }))}
      onChange={(parentId) => (parentId ? void saveLinks([...linkedIds, parentId]) : undefined)}
      placeholder={t('link')}
      searchPlaceholder={t('search')}
      emptyLabel={t('noResults')}
      disabled={parents.isPending || busy}
      isLoading={parents.isPending}
    />
  );

  return (
    <>
      <div ref={sectionRef}>
        <InfoCard
          title={t('title')}
          action={
            !readOnly && student.parents.length > 0 ? (
              <div className="flex items-center gap-3">
                {picker(
                  <Button
                    id="student-link-parent"
                    type="button"
                    variant="link"
                    size="xs"
                    className="px-0 font-semibold"
                  >
                    <SearchIcon data-icon="inline-start" />
                    {t('linkShort')}
                  </Button>,
                )}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="px-0 font-semibold"
                  disabled={busy}
                  onClick={() => onCreateOpenChange(true)}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t('createShort')}
                </Button>
              </div>
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
                        disabled={busy}
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

          {!readOnly && parents.isError ? (
            <QueryErrorAlert title={t('loadError')} onRetry={() => void parents.refetch()} />
          ) : null}

          {!readOnly && student.parents.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              {picker(
                <Button id="student-link-parent" type="button" variant="outline" size="xs">
                  <SearchIcon data-icon="inline-start" />
                  {t('link')}
                </Button>,
              )}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => onCreateOpenChange(true)}
              >
                <PlusIcon data-icon="inline-start" />
                {t('create')}
              </Button>
            </div>
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
