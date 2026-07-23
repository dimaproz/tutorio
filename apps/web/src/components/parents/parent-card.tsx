'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ParentListItem } from '@tutorio/validation';
import { ParentRowActions } from './parent-row-actions';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ROSTER_LIMIT = 3;

// The single parent representation — one grid, every breakpoint.
export function ParentCard({ parent }: { parent: ParentListItem }) {
  const tCommon = useTranslations('common');
  const visible = parent.students.slice(0, ROSTER_LIMIT);
  const overflow = parent.students.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <EntityAvatar avatarKey={parent.avatarKey} fullName={parent.fullName} size="sm" />
          <CardTitle className="min-w-0 truncate text-base">
            <Link
              href={`/app/parents/${parent.id}`}
              className="underline-offset-4 hover:underline"
            >
              {parent.fullName}
            </Link>
          </CardTitle>
        </div>
        <CardAction>
          <ParentRowActions parentId={parent.id} fullName={parent.fullName} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {parent.phone ? <p className="text-muted-foreground">{parent.phone}</p> : null}
        {parent.telegramUsername ? (
          <p className="text-muted-foreground">@{parent.telegramUsername.replace(/^@/, '')}</p>
        ) : null}

        {parent.students.length > 0 ? (
          <p className="text-muted-foreground">
            {visible.map((student) => student.fullName).join(', ')}
            {overflow > 0 ? ` +${overflow}` : ''}
          </p>
        ) : (
          <p className="text-muted-foreground">{tCommon('notProvided')}</p>
        )}
      </CardContent>
    </Card>
  );
}
