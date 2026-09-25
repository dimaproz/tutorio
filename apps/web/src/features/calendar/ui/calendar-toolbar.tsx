'use client';

import type { ReactNode } from 'react';
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { IconButton } from '@/components/shared/icon-button';
import { Segmented } from '@/components/shared/segmented';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CALENDAR_VIEWS, type CalendarView } from '../model/period';

function useViewItems() {
  const t = useTranslations('calendar.views');
  return CALENDAR_VIEWS.map((view) => ({ value: view, label: t(view) }));
}

/**
 * The desktop toolbar (S03): «Сьогодні», previous and next, the range title;
 * on the right the teacher and status filters and «День / Тиждень / Місяць».
 */
export function CalendarToolbar({
  view,
  onViewChange,
  title,
  onToday,
  onStep,
  filters,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  title: string;
  onToday: () => void;
  onStep: (step: 1 | -1) => void;
  filters: ReactNode;
}) {
  const t = useTranslations('calendar');
  const views = useViewItems();
  return (
    <div data-slot="calendar-toolbar" className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={onToday}>
        {t('today')}
      </Button>
      <IconButton
        icon={<ChevronLeftIcon />}
        label={t('previous', { view })}
        tone="paper"
        border
        onClick={() => onStep(-1)}
      />
      <IconButton
        icon={<ChevronRightIcon />}
        label={t('next', { view })}
        tone="paper"
        border
        onClick={() => onStep(1)}
      />
      <h2 className="mr-auto text-xl leading-[26px] font-semibold" aria-live="polite">
        {title}
      </h2>
      {filters}
      <Segmented
        label={t('viewLabel')}
        value={view}
        onValueChange={onViewChange}
        items={views}
        variant="surface"
      />
    </div>
  );
}

/**
 * The phone's header block: «Календар» with «Сьогодні», the view switch, and
 * the date row with previous, next and the filter button.
 */
export function CalendarPhoneBar({
  view,
  onViewChange,
  title,
  onToday,
  onStep,
  filterCount,
  onOpenFilters,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  title: string;
  onToday: () => void;
  onStep: (step: 1 | -1) => void;
  filterCount: number;
  onOpenFilters: () => void;
}) {
  const t = useTranslations('calendar');
  const views = useViewItems();
  return (
    <div data-slot="calendar-phone-bar" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.03em]">{t('title')}</h1>
        <Button type="button" variant="outline" onClick={onToday}>
          {t('today')}
        </Button>
      </div>
      <Segmented
        label={t('viewLabel')}
        value={view}
        onValueChange={onViewChange}
        items={views}
        variant="surface"
        className="self-start"
      />
      <div className="flex items-center gap-2">
        <IconButton
          icon={<ChevronLeftIcon />}
          label={t('previous', { view })}
          tone="paper"
          onClick={() => onStep(-1)}
        />
        <h2
          className="grow truncate text-center text-lg leading-6 font-semibold"
          aria-live="polite"
        >
          {title}
        </h2>
        <IconButton
          icon={<ChevronRightIcon />}
          label={t('next', { view })}
          tone="paper"
          onClick={() => onStep(1)}
        />
        <IconButton
          icon={<SlidersHorizontalIcon />}
          label={
            filterCount > 0 ? t('filters.openWithCount', { count: filterCount }) : t('filters.open')
          }
          tone="paper"
          indicator={filterCount > 0}
          onClick={onOpenFilters}
        />
      </div>
    </div>
  );
}

/** A card over the grid: the empty week, the free day. */
export function CalendarStateCard({
  icon,
  title,
  text,
  actions,
  floating = true,
  className,
}: {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  actions?: ReactNode;
  /** Lifted over the grid with a shadow, or a plain card in the page flow. */
  floating?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="calendar-state-card"
      className={cn('rounded-card bg-card', floating && 'shadow-dialog', className)}
    >
      <EmptyState
        framed={false}
        minHeight={0}
        icon={icon}
        title={title}
        text={text}
        action={
          actions ? <div className="flex flex-wrap justify-center gap-2.5">{actions}</div> : null
        }
        className="py-8"
      />
    </div>
  );
}

/** The failed read: what happened and «Спробувати ще раз». */
export function CalendarErrorCard({
  onRetry,
  retrying = false,
  floating = true,
}: {
  onRetry: () => void;
  retrying?: boolean;
  floating?: boolean;
}) {
  const t = useTranslations('calendar.error');
  return (
    <div
      role="alert"
      data-slot="calendar-error-card"
      className={cn('rounded-card bg-card', floating && 'shadow-dialog')}
    >
      <EmptyState
        framed={false}
        minHeight={0}
        media={
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-tile bg-tint-danger text-tint-danger-foreground [&_svg]:size-6"
          >
            <AlertCircleIcon />
          </span>
        }
        title={t('title')}
        text={t('text')}
        action={
          <Button type="button" disabled={retrying} onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            {t('retry')}
          </Button>
        }
        className="py-8"
      />
    </div>
  );
}
