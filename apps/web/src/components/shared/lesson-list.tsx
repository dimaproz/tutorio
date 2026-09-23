'use client';

import { Fragment, type ReactNode } from 'react';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { LessonItem, type LessonItemState } from '@/components/shared/lesson-item';
import { SectionDivider } from '@/components/shared/section-divider';
import { Segmented, type SegmentedItem } from '@/components/shared/segmented';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type LessonListItem = {
  id: string;
  /** Localized short weekday for the date tile, e.g. "Чт". */
  weekday: string;
  /** Day of the month, e.g. "11". */
  day: string;
  title: ReactNode;
  /** Full meta line, e.g. "вер. · 17:00 – 18:00 · Дмитро Тютор". */
  meta: string;
  /** One short segment for phones, e.g. "17:00 – 18:00 · Дмитро". */
  metaShort?: string;
  /** Status chip, supplied by the feature that owns the lifecycle copy. */
  status?: ReactNode;
  state?: LessonItemState;
  /** The row's `…` menu; phones drop it. */
  menu?: ReactNode;
};

export type LessonListGroup = {
  /** Section heading, e.g. "Coming up · Tue and Thu at 17:00" or "Earlier". */
  label: string;
  items: LessonListItem[];
};

export type LessonListHeader<T extends string = string> =
  | {
      kind: 'tabs';
      /** Accessible name of the tab set. */
      label: string;
      items: SegmentedItem<T>[];
      value: T;
      onChange: (value: T) => void;
    }
  | { kind: 'title'; title: string; meta?: string };

/**
 * A lesson list with a fixed height: the rows scroll inside, so a long history
 * never grows the page. The counter and "show more" sit under the scroll area
 * and stay visible; "show more" loads into the same container. Exactly one row
 * may be the highlighted `next` lesson. Shared by the student profile (tabs
 * header, or bare inside its own section card) and the group page (title
 * header). No copy of its own: every label comes from the caller.
 */
export function LessonList<T extends string = string>({
  header,
  action,
  groups,
  maxHeight = 360,
  shown,
  total,
  countLabel,
  onLoadMore,
  loadMoreLabel,
  loadingMore = false,
  loading = false,
  loadingLabel,
  empty,
  regionLabel,
  compact = false,
  framed = true,
  className,
}: {
  header?: LessonListHeader<T>;
  /** The header command, e.g. "Schedule lesson". */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  groups: LessonListGroup[];
  maxHeight?: number;
  shown: number;
  total: number;
  /** "Showing 7 of 36". */
  countLabel?: string;
  onLoadMore?: () => void;
  /** "Show 12 more". */
  loadMoreLabel?: string;
  loadingMore?: boolean;
  /** The first read: rows are replaced by placeholders. */
  loading?: boolean;
  loadingLabel?: string;
  /** Rendered instead of the list when there are no lessons at all. */
  empty?: ReactNode;
  /** Accessible name of the scrolling region. */
  regionLabel: string;
  /** Phone density: smaller date tiles, the short meta and no row menus. */
  compact?: boolean;
  /** Draws its own card; off when a parent card already frames the list. */
  framed?: boolean;
  className?: string;
}) {
  const hasRows = groups.some((group) => group.items.length > 0);
  const canLoadMore = Boolean(onLoadMore) && shown < total;

  const heading = header ? (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-2">
      {header.kind === 'tabs' ? (
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <Segmented
            label={header.label}
            value={header.value}
            onValueChange={header.onChange}
            items={header.items}
            variant="paper"
          />
        </div>
      ) : (
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="text-base font-semibold">{header.title}</h2>
          {header.meta ? (
            <span className="truncate text-[13px] text-muted-foreground">{header.meta}</span>
          ) : null}
        </div>
      )}
      {action ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={action.disabled}
          onClick={action.onClick}
          className="max-md:hidden"
        >
          <PlusIcon data-icon="inline-start" />
          {action.label}
        </Button>
      ) : null}
    </div>
  ) : null;

  const body = loading ? (
    <div role="status" aria-label={loadingLabel} className="flex flex-col gap-1">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 p-2.5">
          <Skeleton className={cn('rounded-tile', compact ? 'size-13' : 'size-15')} />
          <div className="flex grow flex-col gap-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  ) : !hasRows ? (
    empty
  ) : (
    <>
      <div
        role="region"
        aria-label={regionLabel}
        // The region scrolls, so it takes focus for keyboard scrolling.
        tabIndex={0}
        style={{ maxHeight }}
        className="scrollbar-thin -mr-1 overflow-y-auto rounded-row pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <ul className="flex flex-col">
          {groups.map((group, groupIndex) =>
            group.items.length > 0 ? (
              <Fragment key={group.label}>
                <li className={cn('px-1', groupIndex === 0 ? 'pb-1' : 'pt-2 pb-1')}>
                  <SectionDivider label={group.label} />
                </li>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <LessonItem
                      compact={compact}
                      state={item.state}
                      date={{ top: item.weekday, day: item.day }}
                      title={item.title}
                      meta={
                        item.metaShort ? (
                          <>
                            <span className="md:hidden">{item.metaShort}</span>
                            <span className="max-md:hidden">{item.meta}</span>
                          </>
                        ) : (
                          item.meta
                        )
                      }
                      status={item.status}
                      actions={
                        !compact && item.menu ? (
                          <div className="max-md:hidden">{item.menu}</div>
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </Fragment>
            ) : null,
          )}
        </ul>
      </div>
      {countLabel || canLoadMore ? (
        <div className="flex items-center justify-between gap-3 px-1 pt-1.5">
          <span aria-live="polite" className="text-[13px] text-muted-foreground">
            {countLabel}
          </span>
          {canLoadMore ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loadingMore}
              onClick={onLoadMore}
              className="max-md:h-11"
            >
              {loadingMore ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ChevronDownIcon data-icon="inline-start" />
              )}
              {loadMoreLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const content = (
    <>
      {heading}
      {body}
      {action ? (
        <Button
          type="button"
          variant="outline"
          disabled={action.disabled}
          onClick={action.onClick}
          className="w-full md:hidden"
        >
          <PlusIcon data-icon="inline-start" />
          {action.label}
        </Button>
      ) : null}
    </>
  );

  if (!framed) {
    return (
      <div data-slot="lesson-list" className={cn('flex flex-col gap-3', className)}>
        {content}
      </div>
    );
  }
  return (
    <Card data-slot="lesson-list" className={cn('gap-3 p-4 md:p-5', className)}>
      {content}
    </Card>
  );
}
