'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ParentDetail } from '@tutorio/validation';
import { NotesCard } from '@/components/shared/notes-card';
import { PARENT_NOTES_MAX } from '@/features/parents/model/form';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { useUpdateParentMutation } from '@/lib/api/parents';

/** The tutor's notes about a parent, on the shared `NotesCard`. */
export function ParentNotesCard({ parent }: { parent: ParentDetail }) {
  const t = useTranslations('parents.notes');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const update = useUpdateParentMutation(parent.id);

  return (
    <NotesCard
      notes={parent.notes}
      updatedLabel={t('updated', {
        date: format.dateTime(new Date(parent.updatedAt), { day: 'numeric', month: 'short' }),
      })}
      labels={{
        title: t('title'),
        edit: t('edit'),
        add: t('add'),
        empty: t('empty'),
        placeholder: t('placeholder'),
        save: tCommon('save'),
        cancel: tCommon('cancel'),
      }}
      maxLength={PARENT_NOTES_MAX}
      pending={update.isPending}
      onSave={async (notes) => {
        try {
          await update.mutateAsync({ notes });
          toast.success(t('saved'));
          return true;
        } catch (error) {
          toast.error(tErrors(errorMessageKey(error as GatewayError)));
          return false;
        }
      }}
    />
  );
}
