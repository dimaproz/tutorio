'use client';

import { useId, useState, type ReactNode } from 'react';
import { PauseIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';

/**
 * "Send on a break": pausing a student stops new planning; the tutor may also
 * cancel the lessons already booked, which never consumes package credits.
 * The dialog is presentational: the caller counts the lessons and performs
 * the change.
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
  /** Upcoming individual lessons; undefined while they are being counted. */
  scheduledLessons?: number;
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
          disabled={pending || scheduledLessons === undefined}
          onClick={() => onConfirm({ cancelLessons: lessons > 0 && cancelLessons })}
        >
          {pending ? <Spinner data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}
          {t('confirm')}
        </Button>
      }
    >
      {returnDate}
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
