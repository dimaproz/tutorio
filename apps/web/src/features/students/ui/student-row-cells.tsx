'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { StudentListItem, StudentStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar, type EntityAvatarStatus } from '@/components/shared/entity-avatar';
import { isSameLocalDay, type StudentRollup } from '@/features/students/model/rollups';
import { formatMoneyCompact } from '@/lib/money';
import { capitalizeFirst, cn } from '@/lib/utils';
import { studentLearningFormat } from './student-learning-format';

export const STATUS_DOT: Record<StudentStatusDto, EntityAvatarStatus> = {
  ACTIVE: 'active',
  ON_HOLD: 'hold',
  ARCHIVED: 'archived',
};

/** The best one-line subtitle for a student: the archive date or a contact. */
export function useStudentSubtitle(student: StudentListItem): string {
  const t = useTranslations('students');
  const format = useFormatter();
  if (student.status === 'ARCHIVED') {
    return t('archivedOn', {
      date: format.dateTime(new Date(student.deletedAt ?? student.createdAt), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    });
  }
  const telegram = student.telegramUsername?.replace(/^@/, '');
  return (telegram ? `@${telegram}` : null) ?? student.email ?? student.phone ?? '';
}

/** Avatar with the lifecycle dot, linked name, and the best contact we hold. */
export function StudentIdentityCell({ student }: { student: StudentListItem }) {
  const tStatus = useTranslations('studentStatus');
  const subtitle = useStudentSubtitle(student);

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
          className="truncate text-[15px] leading-5 font-semibold outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
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

/** Format chip plus the teacher of the student's next lesson. */
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
      {teacher ? <span className="truncate text-xs text-muted-foreground">{teacher}</span> : null}
    </div>
  );
}

/**
 * The one placeholder for an empty cell, so every empty column shares one
 * text style instead of borrowing a caption measured for something else.
 */
function CellPlaceholder({ children }: { children: ReactNode }) {
  return <span className="text-[13px] text-muted-foreground">{children}</span>;
}

/**
 * Whether the package read behind the credits and balance cells is complete.
 * Only a complete read may say "no package" or "no invoices"; a failed or
 * partial one says the value is unavailable instead of inventing an absence.
 */
export type PackagesReadState = 'loading' | 'ready' | 'unavailable';

function PackagesPending({ state }: { state: Exclude<PackagesReadState, 'ready'> }) {
  const t = useTranslations('students.list');
  return state === 'loading' ? (
    <Skeleton className="h-4 w-20" />
  ) : (
    <CellPlaceholder>{t('unavailable')}</CellPlaceholder>
  );
}

export function StudentCreditsCell({
  credits,
  packages = 'ready',
}: {
  credits?: StudentRollup['credits'];
  packages?: PackagesReadState;
}) {
  const t = useTranslations('students.list');

  if (packages !== 'ready') {
    return <PackagesPending state={packages} />;
  }

  if (!credits || credits.total === 0) {
    return <CellPlaceholder>{t('noPackage')}</CellPlaceholder>;
  }

  return (
    <CreditMeter
      left={credits.left}
      total={credits.total}
      label={
        credits.left === 0
          ? t('noCreditsLeft')
          : t('creditsLeft', { left: credits.left, total: credits.total })
      }
    />
  );
}

export function StudentNextLessonCell({
  status,
  next,
  now,
  align = 'start',
}: {
  status: StudentStatusDto;
  next?: StudentRollup['next'];
  now: number;
  align?: 'start' | 'end';
}) {
  const t = useTranslations('students.list');
  const format = useFormatter();
  const alignClass = align === 'end' ? 'items-end text-right' : 'items-start';

  if (status === 'ON_HOLD' && !next) {
    return (
      <div className={cn('flex min-w-0 flex-col', alignClass)}>
        <span className="text-sm leading-5 font-medium">{t('paused')}</span>
      </div>
    );
  }

  if (!next || status === 'ARCHIVED') {
    return <CellPlaceholder>{t('noLessonsPlanned')}</CellPlaceholder>;
  }

  const start = new Date(next.startsAtUtc);
  const time = `${format.dateTime(start, { hour: '2-digit', minute: '2-digit' })} · ${t('minutes', { minutes: next.durationMin })}`;

  return (
    <div className={cn('flex min-w-0 flex-col', alignClass)}>
      {isSameLocalDay(next.startsAtUtc, now) ? (
        <Badge variant="brand" dot className="mb-0.5">
          {t('today')}
        </Badge>
      ) : (
        <span className="text-sm leading-5 font-medium">
          {capitalizeFirst(
            format.dateTime(start, { weekday: 'short', day: 'numeric', month: 'short' }),
          )}
        </span>
      )}
      <span className="font-mono text-xs text-muted-foreground">{time}</span>
    </div>
  );
}

export function StudentBalanceCell({
  balance,
  status,
  packages = 'ready',
}: {
  balance?: StudentRollup['balance'];
  status: StudentStatusDto;
  packages?: PackagesReadState;
}) {
  const t = useTranslations('students.list');
  const locale = useLocale();

  if (packages !== 'ready') {
    return <PackagesPending state={packages} />;
  }

  if (!balance) {
    return <CellPlaceholder>{t('noBalance')}</CellPlaceholder>;
  }
  if (balance.kind === 'paid') {
    return status === 'ARCHIVED' ? (
      <Badge variant="neutral">{t('settled')}</Badge>
    ) : (
      <Badge variant="success">{t('paid')}</Badge>
    );
  }
  if (balance.kind === 'partial') {
    return <Badge variant="warning">{t('partlyPaid')}</Badge>;
  }
  return (
    <Badge variant="danger">
      {t('due', { amount: formatMoneyCompact(balance.owedMinor, balance.currency, locale).text })}
    </Badge>
  );
}
