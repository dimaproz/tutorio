'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GroupDetail } from '@tutorio/validation';
import { NotesCard } from '@/components/shared/notes-card';
import { GROUP_NOTES_MAX } from '@/features/groups/model/form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateGroupMutation } from '@/lib/api/groups';
import type { GatewayError } from '@/lib/auth/client';

/** The tutor's notes about a group, on the shared `NotesCard`, edited in place. */
export function GroupNotesCard({ group, readOnly }: { group: GroupDetail; readOnly: boolean }) {
  const t = useTranslations('groups.notes');
  const tToasts = useTranslations('groups.toasts');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const update = useUpdateGroupMutation(group.id);

  return (
    <NotesCard
      notes={group.notes}
      updatedLabel={
        group.notes
          ? t('updated', {
              date: format.dateTime(new Date(group.updatedAt), { day: 'numeric', month: 'short' }),
            })
          : undefined
      }
      labels={{
        title: t('title'),
        edit: t('edit'),
        add: t('add'),
        empty: t('empty'),
        placeholder: t('placeholder'),
        save: t('save'),
        cancel: t('cancel'),
      }}
      maxLength={GROUP_NOTES_MAX}
      readOnly={readOnly}
      pending={update.isPending}
      onSave={async (notes) => {
        try {
          await update.mutateAsync({ notes });
          toast.success(tToasts('notesSaved'));
          return true;
        } catch (error) {
          toast.error(tErrors(errorMessageKey(error as GatewayError)));
          return false;
        }
      }}
    />
  );
}
