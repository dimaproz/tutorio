'use client';

import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { TeacherResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { teacherColor } from '../model/presentation';
import { TeacherAvatar } from './teacher-art';

/** The subjects as chips: on the paper ground of a card, or white on a tint. */
export function TeacherSubjectChips({
  subjects,
  onTint = false,
  className,
}: {
  subjects: readonly string[];
  onTint?: boolean;
  className?: string;
}) {
  if (subjects.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {subjects.map((subject) => (
        <li key={subject}>
          <Badge size="lg" variant={onTint ? 'surface' : 'secondary'} className="text-foreground">
            {subject}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** «Ви» beside the caller's own name. */
export function YouBadge() {
  const t = useTranslations('teachers');
  return (
    <Badge size="sm" variant="indigo">
      {t('you')}
    </Badge>
  );
}

/** «з 12 січ 2026»: when the teacher joined the studio. */
export function useJoinedDate() {
  const format = useFormatter();
  return (teacher: Pick<TeacherResponse, 'createdAt'>) =>
    format.dateTime(new Date(teacher.createdAt), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
}

/** «450 ₴», or null without a default rate. */
export function useTeacherRate() {
  const locale = useLocale();
  return (teacher: Pick<TeacherResponse, 'defaultRateMinor' | 'currency'>) =>
    teacher.defaultRateMinor !== null && teacher.currency
      ? formatMoneyCompact(teacher.defaultRateMinor, teacher.currency, locale)
      : null;
}

/**
 * The teacher as a table row's first cell: the ringed avatar (the owner's
 * with the crown), the name with «Ви», and who they are — «Керує студією» or
 * «з 1 вер 2025». The name links the whole row to the profile.
 */
export function TeacherIdentity({ teacher }: { teacher: TeacherResponse }) {
  const t = useTranslations('teachers');
  const joined = useJoinedDate();
  const archived = teacher.status === 'ARCHIVED';
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <TeacherAvatar
        avatarKey={teacher.avatarKey}
        fullName={teacher.fullName}
        color={teacherColor(teacher)}
        owner={teacher.isMe}
        crownLabel={t('owner')}
        muted={archived}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <Link
            prefetch={false}
            href={`/app/teachers/${teacher.id}`}
            aria-label={t('row.open', { name: teacher.fullName })}
            // The whole row is the target; the name carries the accessible name.
            className="truncate text-[15px] leading-5 font-semibold outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {teacher.fullName}
          </Link>
          {teacher.isMe ? <YouBadge /> : null}
        </span>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {teacher.isMe
            ? t('owner')
            : archived && teacher.archivedAt
              ? t('profile.archivedSince', { date: joined({ createdAt: teacher.archivedAt }) })
              : t('since', { date: joined(teacher) })}
        </span>
      </div>
    </div>
  );
}
