'use client';

import Link from 'next/link';
import { ArrowRightIcon, CalendarDaysIcon, CircleDollarSignIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { GroupRowActions } from './group-row-actions';
import { DeletedBadge, GroupStatusBadge } from '@/components/app/status-badges';
import { CURRENCY_META } from '@/components/app/currency-option';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { formatAmountDisplay } from '@/lib/money';

const ROSTER_LIMIT = 4;
const WEEKDAY_BADGE_VARIANTS: Record<
  number,
  'primary' | 'secondary' | 'success' | 'warning' | 'destructive'
> = {
  0: 'destructive',
  1: 'primary',
  2: 'secondary',
  3: 'primary',
  4: 'warning',
  5: 'success',
  6: 'destructive',
};

function formatScheduleRange(localTime: string, durationMin: number): string {
  const [hours, minutes] = localTime.split(':').map(Number);
  const endMinutes = (hours * 60 + minutes + durationMin) % (24 * 60);
  return `${localTime}–${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(
    endMinutes % 60,
  ).padStart(2, '0')}`;
}

export function GroupCard({ group }: { group: GroupListItem }) {
  const t = useTranslations('groups');
  const locale = useLocale();
  const weekdayLabels = useWeekdayLabels('short');
  const isDeleted = Boolean(group.deletedAt);
  const students = group.students ?? [];
  const visibleStudents = students.slice(0, ROSTER_LIMIT);
  const overflow = students.length - visibleStudents.length;
  const scheduleRows = group.schedules.flatMap((schedule) =>
    schedule.weekdays.map((weekday) => ({
      key: `${schedule.localTime}-${weekday}-${schedule.timezone}`,
      weekday,
      timeRange: formatScheduleRange(schedule.localTime, schedule.durationMin),
    })),
  );

  return (
    <Card className="p-0">
      <CardHeader className="py-2.5 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2 w-full">
          <CardTitle className="min-w-0 flex-1 text-lg">
            {isDeleted ? (
              <span className="block truncate">{group.name}</span>
            ) : (
              <Link
                href={`/app/groups/${group.id}`}
                className="block truncate hover:text-primary/80"
              >
                {group.name}
              </Link>
            )}
          </CardTitle>
          <GroupStatusBadge status={group.status} />
          {isDeleted ? <DeletedBadge label={t('deletedBadge')} /> : null}
        </div>
        <CardAction>
          <GroupRowActions groupId={group.id} name={group.name} isDeleted={isDeleted} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Item size="sm" variant="outline">
            <ItemMedia variant="icon" className="bg-light-success text-success">
              <CircleDollarSignIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="font-normal text-foreground">
                {t('card.defaultPrice')}
              </ItemTitle>
              <ItemDescription className="text-success">
                {group.pricePerLesson != null && group.currency ? (
                  <span className="font-medium tabular">
                    {formatAmountDisplay(group.pricePerLesson, locale)}{' '}
                    {CURRENCY_META[group.currency]?.symbol ?? group.currency}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('card.priceNotSet')}</span>
                )}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item size="sm" variant="outline" className="py-1">
            <ItemContent className="gap-0.5">
              <ItemTitle className="font-normal text-foreground">{t('card.students')}</ItemTitle>
              <div className="flex items-center gap-3">
                {students.length > 0 ? (
                  <AvatarGroup>
                    {visibleStudents.map((student) => (
                      <EntityAvatar
                        key={student.id}
                        avatarKey={student.avatarKey}
                        fullName={student.fullName}
                        size="xs"
                      />
                    ))}
                    {overflow > 0 ? (
                      <AvatarGroupCount className="size-7 text-xs">+{overflow}</AvatarGroupCount>
                    ) : null}
                  </AvatarGroup>
                ) : (
                  <span className="text-muted-foreground">
                    {t('studentCount', { count: group.activeStudentCount })}
                  </span>
                )}
                {students.length > 0 ? (
                  <span>{t('studentCount', { count: group.activeStudentCount })}</span>
                ) : null}
              </div>
            </ItemContent>
          </Item>
        </div>

        <Item variant="outline">
          <ItemMedia variant="icon" className="bg-light-primary text-primary">
            <CalendarDaysIcon className="size-4" aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="font-normal text-foreground">{t('card.schedule')}</ItemTitle>
            <div className="flex items-center gap-2 overflow-hidden">
              {scheduleRows.length === 0 ? (
                <ItemDescription className="truncate text-muted-foreground">
                  {t('card.noSchedule')}
                </ItemDescription>
              ) : (
                <>
                  {scheduleRows.slice(0, 2).map((schedule) => (
                    <div key={schedule.key} className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={WEEKDAY_BADGE_VARIANTS[schedule.weekday]}>
                        {weekdayLabels[schedule.weekday]}
                      </Badge>
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {schedule.timeRange}
                      </span>
                    </div>
                  ))}
                  {scheduleRows.length > 2 ? (
                    <Badge variant="secondary">+{scheduleRows.length - 2}</Badge>
                  ) : null}
                </>
              )}
            </div>
          </ItemContent>
        </Item>
      </CardContent>

      {!isDeleted ? (
        <CardFooter className="justify-end py-3">
          <Button asChild variant="outline">
            <Link href={`/app/groups/${group.id}`}>
              {t('card.details')}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
