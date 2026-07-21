'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { GroupRowActions } from './group-row-actions';
import { DeletedBadge } from '@/components/app/status-badges';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ROSTER_LIMIT = 5;

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

// The single group representation — one grid, every breakpoint.
export function GroupCard({ group }: { group: GroupListItem }) {
  const t = useTranslations('groups');
  const isDeleted = Boolean(group.deletedAt);
  // Defensive: web (Vercel) and the API (Railway) deploy independently, so a
  // web build can briefly reach an API that predates this field.
  const students = group.students ?? [];
  const visible = students.slice(0, ROSTER_LIMIT);
  const overflow = students.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isDeleted ? (
            group.name
          ) : (
            <Link href={`/app/groups/${group.id}`} className="underline-offset-4 hover:underline">
              {group.name}
            </Link>
          )}
        </CardTitle>
        <CardAction>
          <GroupRowActions groupId={group.id} name={group.name} isDeleted={isDeleted} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isDeleted ? <DeletedBadge label={t('deletedBadge')} /> : null}

        {group.notes ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{group.notes}</p>
        ) : null}

        <div className="flex items-center gap-3">
          {students.length > 0 ? (
            <AvatarGroup aria-label={students.map((student) => student.fullName).join(', ')}>
              {visible.map((student) => (
                <Avatar key={student.id} size="sm">
                  <AvatarFallback>{initials(student.fullName)}</AvatarFallback>
                </Avatar>
              ))}
              {overflow > 0 ? (
                <AvatarGroupCount className="size-6 text-xs">+{overflow}</AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          ) : null}
          <span className="tabular text-muted-foreground text-sm">
            {t('studentCount', { count: group.activeStudentCount })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
