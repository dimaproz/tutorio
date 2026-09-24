'use client';

import { LockIcon, PackageCheckIcon, Trash2Icon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { LessonItem } from '@/components/shared/lesson-item';
import { Notice } from '@/components/shared/notice';
import { useDeleteLessonMutation, useTransitionLessonMutation } from '../../api';
import { LessonStatusBadge } from '../lesson-status-badge';
import { useLessonDates } from '../lesson-format';
import { useErrorToast } from '../lesson-form-parts';

/**
 * Delete a lesson that has no charge. A charged one is not a dead end (S01
 * decision 8): the dialog explains why and offers "cancel free" instead,
 * which returns the charge.
 */
export function DeleteDialog({
  lesson,
  open,
  onOpenChange,
  onDeleted,
}: {
  lesson: LessonDetailResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('lessons.deleteDialog');
  const tPanel = useTranslations('lessons.panel');
  const tCancel = useTranslations('lessons.cancelDialog');
  const format = useFormatter();
  const dates = useLessonDates();
  const showError = useErrorToast();
  const remove = useDeleteLessonMutation(lesson.id);
  const transition = useTransitionLessonMutation(lesson.id);
  const charged = lesson.charges.length > 0;
  const start = new Date(lesson.startsAtUtc);
  const busy = remove.isPending || transition.isPending;

  const confirm = async () => {
    try {
      if (charged) {
        await transition.mutateAsync({
          targetStatus: 'CANCELLED_UNCHARGED',
          cancelledBy: lesson.cancelledBy ?? (lesson.groupId ? 'GROUP' : 'STUDENT'),
        });
        toast.success(tCancel('done'));
        onOpenChange(false);
        return;
      }
      await remove.mutateAsync();
      toast.success(t('done'));
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      closeLabel={tPanel('close')}
      icon={<Trash2Icon />}
      iconClassName="bg-tint-danger text-tint-danger-foreground"
      title={charged ? t('blockedTitle') : t('title')}
      secondary={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {charged ? t('close') : t('cancel')}
        </Button>
      }
      primary={
        <Button
          type="button"
          variant={charged ? 'default' : 'destructive'}
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {charged ? t('cancelFree') : t('confirm')}
        </Button>
      }
    >
      <LessonItem
        compact
        className="border border-border"
        date={{
          top: format.dateTime(start, { weekday: 'short' }),
          day: format.dateTime(start, { day: 'numeric' }),
        }}
        title={lesson.group?.name ?? lesson.student?.fullName ?? ''}
        meta={t('meta', {
          time: `${dates.time(lesson.startsAtUtc)}–${dates.endTime(lesson)}`,
          kind: t(lesson.groupId ? 'kind.group' : 'kind.individual'),
        })}
        status={<LessonStatusBadge status={lesson.status} />}
      />
      {charged ? (
        <Notice
          appearance="callout"
          tone="danger"
          icon={<LockIcon />}
          title={t('blockedTitleNotice')}
          text={t('blockedText')}
        />
      ) : (
        <>
          <Notice
            appearance="callout"
            tone="success"
            icon={<PackageCheckIcon />}
            title={t('safeTitle')}
            text={t('safeText')}
          />
          <Notice
            appearance="callout"
            tone="danger"
            icon={<Trash2Icon />}
            title={t('finalTitle')}
            text={t('finalText')}
          />
        </>
      )}
    </AdaptiveDialog>
  );
}
