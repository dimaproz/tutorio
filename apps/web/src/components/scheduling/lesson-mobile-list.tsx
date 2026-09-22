'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { LessonStatusBadge } from '@/components/scheduling/lesson-status';
import { Badge } from '@/components/ui/badge';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { lessonKind } from '@/features/scheduling/model/lesson-table';
import { useDateFormatters } from '@/lib/i18n/format';
import { formatMoneyDisplay } from '@/lib/money';
import type { LessonDialogMode } from './lesson-actions-dialog';
import { LessonRowActions } from './lesson-row-actions';

export function LessonMobileList({
  lessons,
  emptyMessage,
  onOpenDialog,
  readOnly = false,
}: {
  lessons: LessonResponse[];
  emptyMessage: string;
  onOpenDialog: (lesson: LessonResponse, mode: LessonDialogMode) => void;
  readOnly?: boolean;
}) {
  if (lessons.length === 0) return <p className="py-3 text-sm text-muted-foreground">{emptyMessage}</p>;
  return <ul className="flex flex-col gap-3">{lessons.map((lesson) => <li key={lesson.id}><LessonMobileItem lesson={lesson} onOpenDialog={onOpenDialog} readOnly={readOnly} /></li>)}</ul>;
}

export function LessonMobileItem({
  lesson,
  onOpenDialog,
  readOnly = false,
}: {
  lesson: LessonResponse;
  onOpenDialog: (lesson: LessonResponse, mode: LessonDialogMode) => void;
  readOnly?: boolean;
}) {
  const tKind = useTranslations('scheduling.lessonKind');
  const locale = useLocale();
  const format = useDateFormatters();
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>
          {readOnly ? <span>{format.dayMonthTime(lesson.startsAtUtc)}</span> : <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => onOpenDialog(lesson, 'menu')}>
            {format.dayMonthTime(lesson.startsAtUtc)}
          </button>}
        </ItemTitle>
        <ItemDescription className="flex flex-wrap items-center gap-2">
          <LessonStatusBadge status={lesson.status} />
          <Badge variant="secondary">{lesson.group?.name ?? tKind(lessonKind(lesson))}</Badge>
          <span className="font-medium text-foreground">{formatMoneyDisplay(lesson.priceMinor, lesson.currency, locale)}</span>
        </ItemDescription>
      </ItemContent>
      {!readOnly ? <ItemActions><LessonRowActions lesson={lesson} onOpenDialog={onOpenDialog} /></ItemActions> : null}
    </Item>
  );
}
