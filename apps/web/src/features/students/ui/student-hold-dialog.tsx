'use client';

import { useId, useState, type ReactNode } from 'react';
import { PauseIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { Notice } from '@/components/shared/notice';

/**
 * "Send on a break": pausing a student stops new planning; the tutor may also
 * cancel the lessons already booked, which never consumes package credits.
 * The dialog is presentational: the caller counts the lessons and performs
 * the change. When the count fails, the dialog never pretends there is
 * nothing to cancel: it offers a retry, or an explicit pause that leaves the
 * lessons in place.
 */
export function StudentHoldDialog({
  open,
  onOpenChange,
  fullName,
  scheduledLessons,
  countFailed = false,
  retryingCount = false,
  onRetryCount,
  pending = false,
  onConfirm,
  returnDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  /** Upcoming individual lessons; undefined while they are being counted. */
  scheduledLessons?: number;
  /** The lessons could not be counted. */
  countFailed?: boolean;
  /** A retry of the failed count is running. */
  retryingCount?: boolean;
  onRetryCount?: () => void;
  pending?: boolean;
  onConfirm: (options: { cancelLessons: boolean }) => void;
  /** Optional return-date field, for workspaces that can store one. */
  returnDate?: ReactNode;
}) {
  const t = useTranslations('students.holdDialog');
  const tCommon = useTranslations('common');
  const [cancelLessons, setCancelLessons] = useState(true);
  const checkboxId = useId();
  const lessons = scheduledLessons ?? 0;
  // Unknown lessons are never cancelled: the only honest pause keeps them.
  const withoutCancelling = countFailed && scheduledLessons === undefined;

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
        <Button
          type="button"
          disabled={pending || (scheduledLessons === undefined && !withoutCancelling)}
          onClick={() =>
            onConfirm({ cancelLessons: !withoutCancelling && lessons > 0 && cancelLessons })
          }
        >
          {pending ? <Spinner data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}
          {withoutCancelling ? t('confirmWithoutCancelling') : t('confirm')}
        </Button>
      }
    >
      {returnDate}
      {withoutCancelling ? (
        <Notice
          tone="warning"
          title={t('countFailedTitle')}
          text={t('countFailedText')}
          action={
            onRetryCount ? (
              <Button
                type="button"
                variant="white"
                size="xs"
                disabled={pending || retryingCount}
                onClick={onRetryCount}
              >
                {retryingCount ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RotateCcwIcon data-icon="inline-start" />
                )}
                {tCommon('retry')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {lessons > 0 ? (
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-3 rounded-tile bg-background px-4 py-3.5"
        >
          <Checkbox
            id={checkboxId}
            checked={cancelLessons}
            onCheckedChange={(checked) => setCancelLessons(checked === true)}
            disabled={pending}
            className="size-5.5 rounded-[7px] data-checked:border-brand data-checked:bg-brand"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm leading-5 font-semibold">
              {t('cancelLessons', { count: lessons })}
            </span>
            <span className="text-[13px] leading-[18px] text-muted-foreground">
              {t('cancelLessonsHint')}
            </span>
          </span>
        </label>
      ) : null}
    </AdaptiveDialog>
  );
}
