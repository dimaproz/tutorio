'use client';

import type { ReactNode } from 'react';
import { PauseIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';

/**
 * "Send on a break": a whole-student pause from now until the tutor ends it
 * (product/scheduling.md L-104). The server takes the student's individual
 * lessons off the calendar and brings them back on return, keeps them out of
 * group lessons and extends their packages. The dialog is presentational:
 * the caller counts the lessons that come off and performs the change.
 */
export function StudentHoldDialog({
  open,
  onOpenChange,
  fullName,
  scheduledLessons,
  pending = false,
  onConfirm,
  returnDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  /** Upcoming individual lessons; undefined while unknown. */
  scheduledLessons?: number;
  pending?: boolean;
  onConfirm: () => void;
  /** Optional return-date field, for workspaces that can store one. */
  returnDate?: ReactNode;
}) {
  const t = useTranslations('students.holdDialog');
  const tCommon = useTranslations('common');
  const lessons = scheduledLessons ?? 0;

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}
      icon={<PauseIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title')}
      description={t('description', { name: fullName })}
      secondary={
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          {tCommon('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={pending} onClick={onConfirm}>
          {pending ? <Spinner data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}
          {t('confirm')}
        </Button>
      }
    >
      {returnDate}
      {lessons > 0 ? (
        <div className="flex flex-col gap-0.5 rounded-tile bg-background px-4 py-3.5">
          <span className="text-sm leading-5 font-semibold">
            {t('lessonsPaused', { count: lessons })}
          </span>
          <span className="text-[13px] leading-[18px] text-muted-foreground">
            {t('lessonsPausedHint')}
          </span>
        </div>
      ) : null}
    </AdaptiveDialog>
  );
}
