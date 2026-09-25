'use client';

import { CalendarClockIcon, CircleSlashIcon, ExternalLinkIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { panelActions, type LessonPanelIntent } from '@/features/lessons';
import type { ListLesson } from './lesson-cells';

/** What the row menu offers: the panel's own commands for this lesson. */
function offered(lesson: ListLesson, now: number) {
  const { primary, secondary, menu } = panelActions(lesson, now);
  const actions = new Set<string>([
    ...(primary ? [primary] : []),
    ...(secondary ? [secondary] : []),
    ...menu.filter((item) => !item.disabled).map((item) => item.action),
  ]);
  return {
    move: actions.has('move'),
    makeup: actions.has('makeup'),
    cancel: actions.has('cancel'),
  };
}

/**
 * The row's «⋯» (S04 board 09): open the lesson, and move, assign a makeup or
 * cancel it — each opens the S01 panel with that dialog, and only when the
 * panel itself would offer it.
 */
export function LessonRowMenu({
  lesson,
  now,
  onOpen,
}: {
  lesson: ListLesson;
  now: number;
  onOpen: (lessonId: string, intent?: LessonPanelIntent) => void;
}) {
  const t = useTranslations('lessonList.menu');
  const can = offered(lesson, now);
  return (
    <DropdownMenu>
      <RowActionsTrigger label={t('label')} />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onOpen(lesson.id)}>
          <ExternalLinkIcon />
          {t('open')}
        </DropdownMenuItem>
        {can.move ? (
          <DropdownMenuItem onSelect={() => onOpen(lesson.id, 'move')}>
            <CalendarClockIcon />
            {t('move')}
          </DropdownMenuItem>
        ) : null}
        {can.makeup ? (
          <DropdownMenuItem onSelect={() => onOpen(lesson.id, 'makeup')}>
            <RepeatIcon />
            {t('makeup')}
          </DropdownMenuItem>
        ) : null}
        {can.cancel ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onOpen(lesson.id, 'cancel')}>
              <CircleSlashIcon />
              {t('cancel')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
