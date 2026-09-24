'use client';

import Link from 'next/link';
import {
  ArchiveIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { GroupDetail } from '@tutorio/validation';
import { AvatarGroup } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { GroupStatusBadge, type GroupLifecycle } from './group-parts';

/**
 * The group's identity: status and price chips, the name, the teacher, the
 * roster at a glance and the page's commands. A group is a schedule with
 * people attached, so the primary command is "Schedule lesson"; an empty
 * group's is "Add students", an archived one's "Restore".
 */
export function GroupHero({
  group,
  lifecycle,
  justCreated,
  canArchive,
  onAddStudents,
  onArchive,
  onRestore,
  restoring = false,
}: {
  group: GroupDetail;
  lifecycle: GroupLifecycle;
  /** The page opened straight after create. */
  justCreated: boolean;
  canArchive: boolean;
  onAddStudents: () => void;
  onArchive: () => void;
  onRestore: () => void;
  restoring?: boolean;
}) {
  const t = useTranslations('groups');
  const locale = useLocale();
  const archived = lifecycle === 'ARCHIVED';
  const students = group.enrollments.map((enrollment) => enrollment.student);
  const free = group.capacity !== null ? Math.max(0, group.capacity - students.length) : null;
  const price =
    group.pricePerLesson !== null && group.currency
      ? formatMoneyCompact(group.pricePerLesson, group.currency, locale).text
      : null;
  const rosterLine =
    students.length > 0
      ? [
          t('detail.studentsLine', { count: students.length }),
          free !== null ? t('detail.seatsFree', { count: free }) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : [t('detail.noStudentsYet'), price ? t('detail.priceChip', { price }) : null]
          .filter(Boolean)
          .join(' · ');

  const primary = archived ? (
    canArchive ? (
      <Button type="button" size="xl" disabled={restoring} onClick={onRestore}>
        {restoring ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
        {t('detail.restore')}
      </Button>
    ) : null
  ) : (
    <Button type="button" size="xl" leading={<PlusIcon />} onClick={onAddStudents}>
      {t('detail.addStudents')}
    </Button>
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="white" size="icon" aria-label={t('detail.menu')}>
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {archived ? null : (
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={`/app/groups/${group.id}/edit`}>
                <PencilIcon data-icon />
                {t('actions.edit')}
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        {canArchive ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {archived ? (
                <DropdownMenuItem onSelect={onRestore}>
                  <RotateCcwIcon data-icon />
                  {t('actions.restore')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={onArchive}>
                  <ArchiveIcon data-icon />
                  {t('actions.archive')}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Card
      tone="indigo"
      radius="hero"
      data-slot="group-hero"
      data-dim={archived || undefined}
      className="relative gap-4 p-5 md:min-h-80 md:gap-3.5 md:px-8 md:py-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <GroupStatusBadge status={lifecycle} onTint />
          {price && students.length > 0 ? (
            <Badge variant="on-tint" size="lg">
              {t('detail.priceChip', { price })}
            </Badge>
          ) : null}
        </div>
        {menu}
      </div>

      <h1
        className={cn(
          'text-[32px] leading-9 font-semibold tracking-[-0.03em] break-words md:text-[44px] md:leading-[48px]',
          archived && 'text-tint-indigo-meta',
        )}
      >
        {group.name}
      </h1>

      {group.teacher || justCreated ? (
        <div className="flex flex-wrap items-center gap-2 text-[15px]">
          {group.teacher ? (
            <>
              <EntityAvatar
                avatarKey={group.teacher.avatarKey}
                fullName={group.teacher.name}
                size="xs"
                tint="indigo"
              />
              <span>{group.teacher.name}</span>
            </>
          ) : null}
          {justCreated ? (
            <>
              {group.teacher ? (
                <span aria-hidden="true" className="text-tint-indigo-meta">
                  ·
                </span>
              ) : null}
              <span className="text-tint-indigo-meta">{t('detail.createdJustNow')}</span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 items-center gap-3 text-sm text-tint-indigo-meta">
        {students.length > 0 ? (
          <AvatarGroup aria-hidden="true" className="shrink-0">
            {students.slice(0, 6).map((student) => (
              <EntityAvatar
                key={student.id}
                avatarKey={student.avatarKey}
                fullName={student.fullName}
                size="sm"
                tint="indigo"
              />
            ))}
          </AvatarGroup>
        ) : null}
        <span className="min-w-0 truncate">{rosterLine}</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 max-md:[&>*:first-child]:grow">
        {primary}
        {archived ? null : (
          <Button asChild variant="white" size="xl" className="max-md:hidden">
            <Link prefetch={false} href={`/app/groups/${group.id}/edit`}>
              <PencilIcon data-icon="inline-start" />
              {t('detail.edit')}
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
