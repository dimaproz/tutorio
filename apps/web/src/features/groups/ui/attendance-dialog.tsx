'use client';

import { useState } from 'react';
import { CheckCheckIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AttendanceStatusDto, LessonResponse } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { EntityFormDialog } from '@/components/shared/entity-form-dialog';
import { FormActions } from '@/components/shared/form-actions';
import { Segmented } from '@/components/shared/segmented';
import { errorMessageKey } from '@/lib/api/error-message';
import { useLessonAttendanceQuery, useSetLessonAttendanceMutation } from '@/lib/api/attendance';
import type { GatewayError } from '@/lib/auth/client';

type Marks = Record<string, AttendanceStatusDto>;

const STATUSES: AttendanceStatusDto[] = ['PRESENT', 'ABSENT', 'EXCUSED'];
const LABEL_KEY = { PRESENT: 'present', ABSENT: 'absent', EXCUSED: 'excused' } as const;

/**
 * Who came to one group lesson. Each participant gets came / missed /
 * excused; "Everyone came" fills the rest. Saving sends only the marks that
 * changed. The lesson screen will own this later; until then the group
 * page's lesson rows open it.
 */
export function AttendanceDialog({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: LessonResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('groups.attendanceDialog');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tToasts = useTranslations('groups.toasts');
  const format = useFormatter();
  const lessonId = lesson?.id ?? '';
  const sheet = useLessonAttendanceQuery(lessonId, open);
  const save = useSetLessonAttendanceMutation(lessonId);
  const [draft, setDraft] = useState<Marks>({});
  const [seenLesson, setSeenLesson] = useState(lessonId);
  // A different lesson starts from its own saved marks.
  if (seenLesson !== lessonId) {
    setSeenLesson(lessonId);
    setDraft({});
  }

  const participants = sheet.data?.participants ?? [];
  const saved = Object.fromEntries(
    participants.flatMap((row) => (row.status ? [[row.enrollmentId, row.status]] : [])),
  ) as Marks;
  const marks: Marks = { ...saved, ...draft };
  const changed = Object.entries(draft).filter(([id, status]) => saved[id] !== status);

  const close = (next: boolean) => {
    if (!next) setDraft({});
    onOpenChange(next);
  };
  const submit = async () => {
    try {
      await save.mutateAsync({
        marks: changed.map(([enrollmentId, status]) => ({ enrollmentId, status })),
      });
      toast.success(tToasts('attendanceSaved'));
      close(false);
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  };

  const date = lesson
    ? format.dateTime(new Date(lesson.startsAtUtc), {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={close}
      title={t('title')}
      description={t('subtitle', { date })}
      width="md"
      isLoading={sheet.isPending}
      footer={
        <FormActions>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            disabled={save.isPending || changed.length === 0 || sheet.data?.markable === false}
            onClick={() => void submit()}
          >
            {save.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('save')}
          </Button>
        </FormActions>
      }
    >
      {sheet.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t('loadError')}</AlertDescription>
        </Alert>
      ) : sheet.data && !sheet.data.markable ? (
        <Alert role="status">
          <AlertDescription>{t('notMarkable')}</AlertDescription>
        </Alert>
      ) : participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                ...Object.fromEntries(
                  participants
                    .filter((row) => !marks[row.enrollmentId])
                    .map((row) => [row.enrollmentId, 'PRESENT' as const]),
                ),
              }))
            }
          >
            <CheckCheckIcon data-icon="inline-start" />
            {t('markAll')}
          </Button>
          <ul className="flex flex-col gap-2">
            {participants.map((row) => (
              <li key={row.enrollmentId} className="flex flex-wrap items-center gap-3">
                <EntityAvatar
                  avatarKey={row.student.avatarKey}
                  fullName={row.student.fullName}
                  size="sm"
                  tint="indigo"
                />
                <span className="min-w-0 grow truncate text-sm font-medium">
                  {row.student.fullName}
                </span>
                <Segmented
                  label={t('statusLabel', { name: row.student.fullName })}
                  variant="paper"
                  value={marks[row.enrollmentId] ?? ('' as AttendanceStatusDto)}
                  onValueChange={(next) =>
                    setDraft((current) => ({ ...current, [row.enrollmentId]: next }))
                  }
                  items={STATUSES.map((status) => ({ value: status, label: t(LABEL_KEY[status]) }))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </EntityFormDialog>
  );
}
