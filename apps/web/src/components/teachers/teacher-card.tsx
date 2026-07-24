'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TeacherListItem } from '@tutorio/validation';
import { TeacherRowActions } from './teacher-row-actions';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SUBJECT_LIMIT = 3;

// The single teacher representation for the mobile list.
export function TeacherCard({ teacher }: { teacher: TeacherListItem }) {
  const t = useTranslations('teachers');
  const tSubject = useTranslations('subject');
  const visible = teacher.subjects.slice(0, SUBJECT_LIMIT);
  const overflow = teacher.subjects.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: teacher.color ?? '#465FFF' }}
            aria-hidden="true"
          />
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
        {visible.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((subject) => (
              <Badge key={subject} variant="secondary">
                {tSubject(subject)}
              </Badge>
            ))}
            {overflow > 0 ? <Badge variant="outline">+{overflow}</Badge> : null}
          </div>
        ) : null}
        <p className="text-muted-foreground">
          {t('enrollmentsCount', { count: teacher.activeEnrollmentCount })}
        </p>
      </CardContent>
    </Card>
  );
}
