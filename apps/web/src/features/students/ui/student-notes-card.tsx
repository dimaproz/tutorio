'use client';

import { useState } from 'react';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateStudentMutation } from '@/lib/api/students';

const NOTES_MAX_LENGTH = 4000;

/**
 * The tutor's own notes, editable where they are read. The card stays visible
 * when empty so there is somewhere obvious to put the first one.
 */
export function StudentNotesCard({
  student,
  readOnly = false,
}: {
  student: StudentDetail;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.notes');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const update = useUpdateStudentMutation(student.id);
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(student.notes ?? '');

  const startEditing = () => {
    setDraft(student.notes ?? '');
    setEditing(true);
  };

  const save = () => {
    const trimmed = draft.trim();
    update.mutate(
      { notes: trimmed.length > 0 ? trimmed : null },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success(t('saved'));
        },
        onError: (error) => toast.error(tErrors(errorMessageKey(error))),
      },
    );
  };

  if (readOnly && !student.notes) {
    return null;
  }

  return (
    <Card tone="warning" className="gap-2.5 px-6 py-5.5">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        {!readOnly && !editing && student.notes ? (
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
            maxLength={NOTES_MAX_LENGTH}
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
              onClick={() => setEditing(false)}
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      ) : student.notes ? (
        <>
          <p className="text-sm leading-[22px] whitespace-pre-wrap">{student.notes}</p>
          <p className="text-xs text-tint-warning-foreground">
            {t('updated', {
              date: format.dateTime(new Date(student.updatedAt), {
                day: 'numeric',
                month: 'short',
              }),
            })}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm leading-5 text-muted-foreground">{t('empty')}</p>
          {!readOnly ? (
            <div>
              <Button type="button" variant="white" size="xs" onClick={startEditing}>
                <PlusIcon data-icon="inline-start" />
                {t('add')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
