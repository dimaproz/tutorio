'use client';

import {
  CalendarClockIcon,
  CheckIcon,
  RotateCcwIcon,
  UserXIcon,
  StickyNoteIcon,
  XCircleIcon,
} from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonResponse } from '@tutorio/validation';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { errorMessageKey } from '@/lib/api/error-message';
import { useTransitionLessonMutation } from '@/lib/api/scheduling';
import type { LessonDialogMode } from './lesson-actions-dialog';
import { lessonActions } from '@/features/scheduling/model/lesson-actions';

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
  const now = useNow({ updateInterval: 60_000 });
  const actions = lessonActions(lesson, now.getTime());

  const flipTo = (targetStatus: 'COMPLETED' | 'SCHEDULED' | 'NO_SHOW') => {
    transition.mutate(
      { lessonId: lesson.id, dto: { targetStatus } },
      { onError: (error) => toast.error(tErrors(errorMessageKey(error))) },
    );
  };

  return (
    <DropdownMenu>
      <RowActionsTrigger busy={transition.isPending} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {actions.complete ? (
            <DropdownMenuItem onSelect={() => flipTo('COMPLETED')}>
              <CheckIcon data-icon />
              {lesson.status === 'SCHEDULED' ? t('complete') : t('markHeld')}
            </DropdownMenuItem>
          ) : null}
          {actions.reschedule ? (
            <DropdownMenuItem onSelect={() => onOpenDialog(lesson, 'reschedule')}>
              <CalendarClockIcon data-icon />
              {t('reschedule')}
            </DropdownMenuItem>
          ) : null}
          {actions.noShow ? (
            <DropdownMenuItem onSelect={() => flipTo('NO_SHOW')}>
              <UserXIcon data-icon />
              {t('noShow')}
            </DropdownMenuItem>
          ) : null}
          {actions.cancel ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onOpenDialog(lesson, 'cancel')}>
              <XCircleIcon data-icon />
              {t('cancel')}
            </DropdownMenuItem>
          ) : null}
          {actions.reactivate ? (
            <DropdownMenuItem onSelect={() => flipTo('SCHEDULED')}>
              <RotateCcwIcon data-icon />
              {t('reactivate')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onOpenDialog(lesson, 'menu')}>
            <StickyNoteIcon data-icon />
            {t('details')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
