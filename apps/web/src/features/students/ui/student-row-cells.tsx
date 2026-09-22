'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { StudentListItem, StudentStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar, type EntityAvatarStatus } from '@/components/shared/entity-avatar';
import { PENDING_VALUE } from '@/features/students/model/pending-data';
import { studentLearningFormat } from './student-card';

const STATUS_DOT: Record<StudentStatusDto, EntityAvatarStatus> = {
  ACTIVE: 'active',
  ON_HOLD: 'hold',
  ARCHIVED: 'archived',
};

/** Avatar with the lifecycle dot, linked name, and the best contact we hold. */
export function StudentIdentityCell({ student }: { student: StudentListItem }) {
  const t = useTranslations('students');
  const tStatus = useTranslations('studentStatus');
  const format = useFormatter();

  const archivedAt = student.deletedAt ?? student.createdAt;
  const subtitle =
    student.status === 'ARCHIVED'
      ? t('archivedOn', {
          date: format.dateTime(new Date(archivedAt), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        })
      : (student.telegramUsername ?? student.email ?? student.phone ?? '');

  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <EntityAvatar
        avatarKey={student.avatarKey}
        fullName={student.fullName}
        status={STATUS_DOT[student.status]}
        statusLabel={tStatus(student.status)}
      />
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/app/students/${student.id}`}
          // The whole row is the target; the name carries the accessible name.
          className="truncate text-[15px] leading-5 font-semibold outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:ring-3 focus-visible:after:ring-ring/30"
        >
          {student.fullName}
        </Link>
        {subtitle ? (
          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Format chip plus the teacher, which the list endpoint does not return yet. */
export function StudentLearningCell({
  student,
  teacher,
}: {
  student: StudentListItem;
  teacher?: string;
}) {
  const t = useTranslations('students');
  const format = studentLearningFormat(student);

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {format === 'groups' ? (
        <Badge variant="info">{student.groupNames[0]}</Badge>
      ) : format === 'individual' ? (
        <Badge variant="indigo">{t('individual')}</Badge>
      ) : (
        <Badge variant="neutral">{t('notConfigured')}</Badge>
      )}
      {teacher ? (
        <span className="truncate text-xs text-muted-foreground">{teacher}</span>
      ) : null}
    </div>
  );
}

/**
 * The one placeholder for an empty cell. Both empty columns share it so they
 * cannot drift apart: routing the text through a component that also draws
 * something else picks up that component's caption size, which is measured to
 * sit under a meter rather than to stand alone in a cell.
 */
function CellPlaceholder({ children }: { children: ReactNode }) {
  return <span className="text-[13px] text-muted-foreground">{children}</span>;
}

/**
 * Credits, the next lesson and the balance are all per-student rollups the
 * list endpoint does not compute. Each renders the design's own empty state
 * rather than a number, so a reader is never misled.
 */
export function StudentCreditsCell({ left, total }: { left?: number; total?: number }) {
  const t = useTranslations('students.list');

  if (left == null || total == null || total === 0) {
    return <CellPlaceholder>{t('noPackage')}</CellPlaceholder>;
  }

  return (
    <CreditMeter
      left={left}
      total={total}
      label={left === 0 ? t('noCreditsLeft') : t('creditsLeft', { left, total })}
    />
  );
}

export function StudentNextLessonCell({
  date,
  time,
  today = false,
}: {
  date?: string;
  time?: string;
  today?: boolean;
}) {
  const t = useTranslations('students.list');

  if (!date && !today) {
    return <CellPlaceholder>{t('noLessonsPlanned')}</CellPlaceholder>;
  }

  return (
    <div className="flex min-w-0 flex-col items-start">
      {today ? (
        <Badge variant="brand" dot className="mb-0.5">
          {t('today')}
        </Badge>
      ) : (
        <span className="text-sm leading-5 font-medium">{date}</span>
      )}
      {time ? <span className="font-mono text-xs text-muted-foreground">{time}</span> : null}
    </div>
  );
}

export function StudentBalanceCell({
  label,
  tone,
  empty,
}: {
  label?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  /** Shown when there is no balance to report. */
  empty?: string;
}) {
  if (!label) {
    return <CellPlaceholder>{empty ?? PENDING_VALUE}</CellPlaceholder>;
  }
  return <Badge variant={tone ?? 'neutral'}>{label}</Badge>;
}
