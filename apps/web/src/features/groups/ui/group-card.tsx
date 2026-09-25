'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  GroupNextLesson,
  GroupRosterStack,
  GroupSchedulePills,
  GroupStatusBadge,
  type GroupLifecycle,
} from './group-parts';

export function groupLifecycle(group: Pick<GroupListItem, 'deletedAt' | 'status'>): GroupLifecycle {
  return group.deletedAt ? 'ARCHIVED' : group.status;
}

/** "400 ₴", or nothing when the group has no price of its own. */
export function useGroupPrice(group: Pick<GroupListItem, 'pricePerLesson' | 'currency'>) {
  const locale = useLocale();
  return group.pricePerLesson !== null && group.currency
    ? formatMoneyCompact(group.pricePerLesson, group.currency, locale).text
    : null;
}

/**
 * A group as a card: the grid view of the collection and the phone list. The
 * whole card links to the group page. Name, teacher and status on top, the
 * weekday pills, the roster with its seats, then the next lesson and price.
 */
export function GroupCard({
  group,
  variant = 'grid',
  ground = 'card',
}: {
  group: GroupListItem;
  /** `phone` folds the next lesson beside the roster and drops the price row. */
  variant?: 'grid' | 'phone';
  /** `paper` inside another card (a teacher's groups, S09). */
  ground?: 'card' | 'paper';
}) {
  const t = useTranslations('groups');
  const price = useGroupPrice(group);
  const lifecycle = groupLifecycle(group);
  const phone = variant === 'phone';

  return (
    <article
      data-slot="group-card"
      data-archived={lifecycle === 'ARCHIVED' || undefined}
      className={cn(
        'relative flex flex-col text-card-foreground transition-colors duration-150 has-[a:hover]:bg-surface-hover data-[archived]:text-muted-foreground',
        ground === 'paper' ? 'bg-background' : 'bg-card',
        phone ? 'gap-3.5 rounded-row p-4' : 'gap-4 rounded-card p-7',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            prefetch={false}
            href={`/app/groups/${group.id}`}
            aria-label={t('row.open', { name: group.name })}
            className="text-[19px] leading-6 font-semibold tracking-[-0.01em] outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {group.name}
          </Link>
          <span className="truncate text-[15px] text-muted-foreground">
            {group.teacher?.name ?? t('row.noTeacher')}
          </span>
        </div>
        <GroupStatusBadge status={lifecycle} />
      </div>

      <GroupSchedulePills schedules={group.schedules} />

      {phone ? (
        <div className="flex items-center justify-between gap-3">
          <GroupRosterStack group={group} max={4} short />
          {group.nextLesson ? <GroupNextLesson startsAtUtc={group.nextLesson.startsAtUtc} /> : null}
        </div>
      ) : (
        <>
          <GroupRosterStack group={group} />
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
            <GroupNextLesson startsAtUtc={group.nextLesson?.startsAtUtc ?? null} />
            {price ? (
              <span className="shrink-0 font-mono text-sm tabular-nums">{price}</span>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}
