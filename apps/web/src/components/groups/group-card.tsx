'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { GroupRowActions } from './group-row-actions';
import { DeletedBadge } from '@/components/app/status-badges';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mobile representation of a group row.
export function GroupCard({ group }: { group: GroupListItem }) {
  const t = useTranslations('groups');
  const isDeleted = Boolean(group.deletedAt);

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
      <CardContent className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular text-muted-foreground">
          {t('studentCount', { count: group.activeStudentCount })}
        </span>
        {isDeleted ? <DeletedBadge label={t('deletedBadge')} /> : null}
      </CardContent>
    </Card>
  );
}
