'use client';

import { useRef, useState } from 'react';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ParentDetail } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { PARENT_NOTES_MAX } from '@/features/parents/model/form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateParentMutation } from '@/lib/api/parents';

/**
 * The tutor's notes about a parent, editable where they are read. The card
 * stays visible when empty so there is somewhere obvious to put the first one.
 */
export function ParentNotesCard({ parent }: { parent: ParentDetail }) {
  const t = useTranslations('parents.notes');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const update = useUpdateParentMutation(parent.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parent.notes ?? '');
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Save and Cancel disappear with the editor while one of them has focus;
  // the title is there in every state, so focus returns to it.
  const stopEditing = () => {
    setEditing(false);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const startEditing = () => {
    setDraft(parent.notes ?? '');
    setEditing(true);
  };

  const save = () => {
    const trimmed = draft.trim();
    update.mutate(
      { notes: trimmed.length > 0 ? trimmed : null },
      {
        onSuccess: () => {
          stopEditing();
          toast.success(t('saved'));
        },
        onError: (error) => toast.error(tErrors(errorMessageKey(error))),
      },
    );
  };

  return (
    <Card tone="warning" className="gap-2.5 px-6 py-5.5">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 ref={titleRef} tabIndex={-1} className="text-base font-semibold outline-none">
          {t('title')}
        </h2>
        {!editing && parent.notes ? (
          <Button
            type="button"
            variant="translucent"
            size="icon-xs"
            aria-label={t('edit')}
            onClick={startEditing}
          >
            <PencilIcon />
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea
            autoFocus
            rows={5}
            maxLength={PARENT_NOTES_MAX}
            aria-label={t('title')}
            placeholder={t('placeholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="bg-card"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={update.isPending} onClick={save}>
              {update.isPending ? <Spinner data-icon="inline-start" /> : null}
              {tCommon('save')}
            </Button>
            <Button
              type="button"
              variant="white"
              size="sm"
              disabled={update.isPending}
              onClick={stopEditing}
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      ) : parent.notes ? (
        <>
          <p className="text-sm leading-[22px] whitespace-pre-wrap">{parent.notes}</p>
          <p className="text-xs text-tint-warning-foreground">
            {t('updated', {
              date: format.dateTime(new Date(parent.updatedAt), { day: 'numeric', month: 'short' }),
            })}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm leading-5 text-muted-foreground">{t('empty')}</p>
          <div>
            <Button type="button" variant="white" size="xs" onClick={startEditing}>
              <PlusIcon data-icon="inline-start" />
              {t('add')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
