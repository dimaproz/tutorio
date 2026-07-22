'use client';

import Link from 'next/link';
import { ClockIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { StudentRowActions } from './student-row-actions';
import { StudentStatusBadge } from './student-status-badge';
import { DeletedBadge } from '@/components/app/status-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function studentInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

// Mobile presentation of a student. The desktop table shows the same data as
// an accessible table instead.
export function StudentCard({ student }: { student: StudentListItem }) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const isDeleted = Boolean(student.deletedAt);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{studentInitials(student.fullName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate text-base">
              {isDeleted ? (
                student.fullName
              ) : (
                <Link
                  href={`/app/students/${student.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {student.fullName}
                </Link>
              )}
            </CardTitle>
            <CardDescription className="truncate">
              {student.email ?? student.phone ?? tCommon('notProvided')}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <StudentRowActions
            studentId={student.id}
            fullName={student.fullName}
            isDeleted={isDeleted}
            status={student.status}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {isDeleted ? <DeletedBadge label={t('deletedBadge')} /> : null}
          {!isDeleted && student.status === 'ON_HOLD' ? (
            <StudentStatusBadge status={student.status} />
          ) : null}
          <span className="tabular text-muted-foreground">
            {t('activeEnrollments', { count: student.activeEnrollmentCount })}
          </span>
        </div>
        {student.groupNames.length > 0 ? (
          <p className="text-muted-foreground">{student.groupNames.join(', ')}</p>
        ) : null}
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <ClockIcon className="size-3.5" aria-hidden="true" />
          {student.timezone}
        </p>
      </CardContent>
    </Card>
  );
}
