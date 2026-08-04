'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TeacherListItem } from '@tutorio/validation';
import { TeacherRowActions } from './teacher-row-actions';
import { TeacherStatusBadge } from './teacher-status-badge';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// The single teacher representation for the mobile list.
export function TeacherCard({ teacher }: { teacher: TeacherListItem }) {
  const t = useTranslations('teachers');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <EntityAvatar avatarKey={teacher.avatarKey} fullName={teacher.fullName} size="sm" />
          <CardTitle className="min-w-0 truncate text-base">
            <Link
              href={`/app/teachers/${teacher.id}`}
              className="underline-offset-4 hover:underline"
            >
              {teacher.fullName}
            </Link>
          </CardTitle>
        </div>
        <CardAction>
          <TeacherRowActions teacherId={teacher.id} fullName={teacher.fullName} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <TeacherStatusBadge status={teacher.status} />
          {/* The owner's own profile is created with the workspace — labelling
              it stops a duplicate "me" being added by hand. */}
          {teacher.isMe ? <Badge variant="primary">{t('you')}</Badge> : null}
        </div>
        <p className="text-muted-foreground">
          {t('enrollmentsCount', { count: teacher.activeEnrollmentCount })}
        </p>
      </CardContent>
    </Card>
  );
}
