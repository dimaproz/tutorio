'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { StudentRowActions } from './student-row-actions';
import { StudentStatusBadge } from '@/features/students/ui/student-status';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function studentLearningFormat(
  student: Pick<StudentListItem, 'groupNames' | 'activeEnrollmentCount'>,
): 'groups' | 'individual' | 'notConfigured' {
  if (student.groupNames.length > 0) {
    return 'groups';
  }
  return student.activeEnrollmentCount > 0 ? 'individual' : 'notConfigured';
}

/** Shared learning-format presentation for the Student table and mobile card. */
export function StudentLearningFormat({
  student,
}: {
  student: Pick<StudentListItem, 'groupNames' | 'activeEnrollmentCount'>;
}) {
  const t = useTranslations('students');
  const format = studentLearningFormat(student);

  if (format === 'groups') {
    return <span>{student.groupNames.join(', ')}</span>;
  }

  return <span className="text-muted-foreground">{t(format)}</span>;
}

/** Shared compact absolute date for the Student table and mobile card. */
export function StudentAddedDate({ createdAt }: { createdAt: string }) {
  const format = useFormatter();
  return (
    <span className="tabular whitespace-nowrap text-muted-foreground">
      {format.dateTime(new Date(createdAt), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}
    </span>
  );
}

// Mobile presentation of a student. The desktop table uses the same format and
// date helpers, while keeping the required accessible table structure.
export function StudentCard({ student }: { student: StudentListItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <EntityAvatar avatarKey={student.avatarKey} fullName={student.fullName} size="sm" />
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate text-base">
              <Link
                href={`/app/students/${student.id}`}
                className="underline-offset-4 hover:underline"
              >
                {student.fullName}
              </Link>
            </CardTitle>
          </div>
        </div>
        <CardAction>
          <StudentRowActions
            studentId={student.id}
            fullName={student.fullName}
            avatarKey={student.avatarKey}
            status={student.status}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StudentStatusBadge status={student.status} />
        </div>
        <StudentLearningFormat student={student} />
        <StudentAddedDate createdAt={student.createdAt} />
      </CardContent>
    </Card>
  );
}
