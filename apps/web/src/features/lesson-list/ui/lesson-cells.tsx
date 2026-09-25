'use client';

import type { ReactNode } from 'react';
import { LayersIcon, RepeatIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { LessonStatusBadge } from '@/features/lessons';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { lessonKind, needsMakeup, type PaymentView } from '../model/payment';

export type ListLesson = LessonResponse;

/** «10:00–11:30» and «26 вер · сб», in the browser's zone like the calendar. */
export function useLessonWhen() {
  const format = useLocalFormatter();
  const time = (ms: number) => format.time(ms);
  return (lesson: Pick<ListLesson, 'startsAtUtc' | 'durationMin'>) => {
    const start = Date.parse(lesson.startsAtUtc);
    const date = new Date(start);
    return {
      range: `${time(start)}–${time(start + lesson.durationMin * 60_000)}`,
      // «26 вер · сб»: the design writes the short month without its period.
      day: [
        format.dateTime(date, { day: 'numeric', month: 'short' }).replace(/\.$/, ''),
        format.dateTime(date, { weekday: 'short' }),
      ].join(' · '),
    };
  };
}

/** The group's tile, or the student's avatar. */
export function WhoMedia({ lesson, size = 'md' }: { lesson: ListLesson; size?: 'sm' | 'md' }) {
  if (lesson.group) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-item bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-5',
          size === 'md' ? 'size-11' : 'size-9',
        )}
      >
        <LayersIcon />
      </span>
    );
  }
  return (
    <EntityAvatar
      avatarKey={lesson.student?.avatarKey}
      fullName={lesson.student?.fullName ?? ''}
      size={size}
    />
  );
}

export function useKindLabel() {
  const t = useTranslations('lessonList.kind');
  return (lesson: ListLesson) => t(lessonKind(lesson));
}

/** Who the lesson is for, with the kind under the name. */
export function WhoCell({ lesson }: { lesson: ListLesson }) {
  const kind = useKindLabel();
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <WhoMedia lesson={lesson} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] leading-5 font-semibold">
          {lesson.group?.name ?? lesson.student?.fullName ?? ''}
        </span>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {kind(lesson)}
        </span>
      </div>
    </div>
  );
}

export function TeacherCell({
  name,
  avatarKey,
}: {
  name: string;
  avatarKey: string | null | undefined;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <EntityAvatar avatarKey={avatarKey} fullName={name} size="xs" tint="paper" />
      <span className="truncate text-[15px] leading-5">{name}</span>
    </div>
  );
}

/** The status chip, and «Відпрацювання» or «Без відпрацювання» under it. */
export function StatusCell({ lesson, className }: { lesson: ListLesson; className?: string }) {
  const t = useTranslations('lessonList.chips');
  const makeup = lesson.kind === 'MAKEUP';
  const due = needsMakeup(lesson);
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1', className)}>
      <LessonStatusBadge status={lesson.status} />
      {makeup ? (
        <Badge variant="indigo" className="font-semibold">
          <RepeatIcon data-icon="inline-start" />
          {t('makeup')}
        </Badge>
      ) : due ? (
        <Badge variant="warning" className="font-semibold">
          <RepeatIcon data-icon="inline-start" />
          {t('noMakeup')}
        </Badge>
      ) : null}
    </div>
  );
}

const MARK_CLASS: Record<string, string> = {
  success: 'bg-success',
  danger: 'bg-danger-mark',
  warning: 'bg-warning',
  brand: 'bg-brand',
};

function Mark({
  tone,
  strong = false,
  className,
  children,
}: {
  tone?: keyof typeof MARK_CLASS;
  strong?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-2 text-sm leading-5',
        tone ? 'text-foreground' : 'text-muted-foreground',
        tone === 'success' && 'text-tint-success-foreground',
        tone === 'danger' && 'text-destructive',
        strong && 'font-semibold',
        className,
      )}
    >
      {tone ? (
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-pill', MARK_CLASS[tone])}
        />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** The payment cell (S04 decision 6). */
export function PaymentCell({ view, className }: { view: PaymentView; className?: string }) {
  const t = useTranslations('lessonList.payment');
  switch (view.kind) {
    case 'paid':
      return (
        <Mark tone="success" className={className}>
          {t('paid')}
        </Mark>
      );
    case 'unpaid':
      return (
        <Mark tone="danger" strong className={className}>
          {t('unpaid')}
        </Mark>
      );
    case 'debt':
      return (
        <Mark tone="danger" strong className={className}>
          {t('debt')}
        </Mark>
      );
    case 'package':
      return (
        <Mark tone="brand" className={className}>
          {view.state ? t('packageState', view.state) : t('package')}
        </Mark>
      );
    case 'group':
      return (
        <Mark tone={view.paid === view.total ? 'success' : 'warning'} className={className}>
          {t('groupPaid', { paid: view.paid, total: view.total })}
        </Mark>
      );
    case 'later':
      return <Mark className={className}>{t('later')}</Mark>;
    case 'free':
      return <Mark className={className}>{t('free')}</Mark>;
    case 'noCharge':
      return <Mark className={className}>{t('noCharge')}</Mark>;
  }
}

/** «450 ₴», and «з учня» under a group's price. */
export function PriceCell({
  lesson,
  align = 'end',
}: {
  lesson: ListLesson;
  align?: 'end' | 'start';
}) {
  const t = useTranslations('lessonList');
  const locale = useLocale();
  return (
    <div className={cn('flex flex-col', align === 'end' ? 'items-end' : 'items-start')}>
      <span className="text-[15px] leading-5 font-semibold tabular-nums">
        {formatMoneyCompact(lesson.priceMinor, lesson.currency, locale).text}
      </span>
      {lesson.group ? (
        <span className="text-xs leading-4 text-muted-foreground">{t('perStudent')}</span>
      ) : null}
    </div>
  );
}
