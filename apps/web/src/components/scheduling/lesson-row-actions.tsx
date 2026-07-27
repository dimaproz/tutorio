'use client';

import {
  CalendarClockIcon,
  CheckIcon,
  RotateCcwIcon,
  StickyNoteIcon,
  XCircleIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonResponse } from '@tutorio/validation';
import { RowActionsTrigger } from '@/components/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { errorMessageKey } from '@/lib/api/error-message';
import { useTransitionLessonMutation } from '@/lib/api/scheduling';
import type { LessonDialogMode } from './lesson-actions-dialog';

/**
 * Row menu for a lesson. The one-click status flips run here; everything that
 * needs a form — rescheduling, cancelling, notes — opens the shared actions
 * dialog on the matching panel, so those flows exist in exactly one place.
 */
export function LessonRowActions({
  lesson,
  onOpenDialog,
}: {
  lesson: LessonResponse;
  onOpenDialog: (lesson: LessonResponse, mode: LessonDialogMode) => void;
}) {
  const t = useTranslations('scheduling.actions');
  const tErrors = useTranslations('errors');

  const transition = useTransitionLessonMutation();
  const isScheduled = lesson.status === 'SCHEDULED';

  const flipTo = (targetStatus: 'COMPLETED' | 'SCHEDULED') => {
    transition.mutate(
      { lessonId: lesson.id, dto: { targetStatus } },
      { onError: (error) => toast.error(tErrors(errorMessageKey(error))) },
    );
  };

  return (
    <DropdownMenu>
      <RowActionsTrigger busy={transition.isPending} />
      <DropdownMenuContent align="end">
        {isScheduled ? (
          <>
            <DropdownMenuItem onSelect={() => flipTo('COMPLETED')} variant="success">
              <CheckIcon />
              {t('complete')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenDialog(lesson, 'reschedule')} variant="warning">
              <CalendarClockIcon />
              {t('reschedule')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onOpenDialog(lesson, 'cancel')}
            >
              <XCircleIcon />
              {t('cancel')}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => flipTo('SCHEDULED')}>
            <RotateCcwIcon />
            {t('reactivate')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenDialog(lesson, 'menu')}>
          <StickyNoteIcon />
          {t('details')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
