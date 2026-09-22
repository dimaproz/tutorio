'use client';

import Link from 'next/link';
import { MailIcon, PencilIcon, PhoneIcon, PlusIcon, RotateCcwIcon, SendIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { ProfileHero } from '@/components/shared/profile-hero';
import { studentLifecyclePolicy } from '@/features/students/model/lifecycle';
import { StudentStatusControl, type StudentStatusActions } from './student-status-control';

/**
 * The student's identity block. The status pill changes the lifecycle in
 * place; the commands follow the status: an active student is scheduled and
 * edited, a paused one only edited, an archived one only restored.
 */
export function StudentProfileHero({
  student,
  statusActions,
  onSchedule,
  onRestore,
  restoring = false,
}: {
  student: StudentDetail;
  statusActions: StudentStatusActions;
  onSchedule: () => void;
  onRestore: () => void;
  restoring?: boolean;
}) {
  const t = useTranslations('students.detail');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const format = useFormatter();
  const policy = studentLifecyclePolicy(student.status);
  const telegram = student.telegramUsername?.replace(/^@/, '');
  const archived = student.status === 'ARCHIVED';
  const longDate = (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' });

  const meta = [
    student.languageLevel ? tLanguage(student.languageLevel) : t('levelUnknown'),
    student.knowledgeLevel ? tKnowledge(student.knowledgeLevel) : null,
    student.age != null ? t('ageYears', { age: student.age }) : null,
    student.grade != null ? t('gradeShort', { grade: student.grade }) : null,
    student.languageLevel || student.age != null ? null : student.timezone,
  ].filter((value): value is string => Boolean(value));

  const contact = (href: string, label: string, icon: ReactNode, external = false) => (
    <Button asChild variant="white" size="icon" aria-label={label}>
      <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {icon}
      </a>
    </Button>
  );
  const contacts =
    student.phone || telegram || student.email ? (
      <>
        {student.phone
          ? contact(
              `tel:${student.phone}`,
              t('callContact', { value: student.phone }),
              <PhoneIcon />,
            )
          : null}
        {telegram
          ? contact(
              `https://t.me/${telegram}`,
              t('messageContact', { value: `@${telegram}` }),
              <SendIcon />,
              true,
            )
          : null}
        {student.email
          ? contact(
              `mailto:${student.email}`,
              t('emailContact', { value: student.email }),
              <MailIcon />,
            )
          : null}
      </>
    ) : undefined;

  const primary = policy.hero.includes('schedule') ? (
    <Button type="button" leading={<PlusIcon />} onClick={onSchedule}>
      {t('scheduleLesson')}
    </Button>
  ) : policy.hero.includes('restore') ? (
    <Button type="button" variant="white" onClick={onRestore} disabled={restoring}>
      {restoring ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RotateCcwIcon data-icon="inline-start" />
      )}
      {t('restore')}
    </Button>
  ) : undefined;

  const edit = policy.hero.includes('edit') ? (
    <Button asChild variant="white">
      <Link href={`/app/students/${student.id}/edit`}>
        <PencilIcon data-icon="inline-start" />
        {t('edit')}
      </Link>
    </Button>
  ) : undefined;

  return (
    <ProfileHero
      glyph={student.languageLevel ?? undefined}
      dim={archived}
      avatar={
        <EntityAvatar
          avatarKey={student.avatarKey}
          fullName={student.fullName}
          size="2xl"
          ring="hero"
          tint="surface"
        />
      }
      badges={
        <>
          <StudentStatusControl student={student} size="sm" actions={statusActions} />
          <Badge variant="on-tint" size="lg">
            {archived && student.deletedAt
              ? t('archivedOn', { date: longDate(student.deletedAt) })
              : t('addedOn', { date: longDate(student.createdAt) })}
          </Badge>
        </>
      }
      name={student.fullName}
      meta={meta}
      contacts={contacts}
      // An archived student's only command is Restore, which reads as the
      // primary one on every layout; on phones it stays inline like Edit.
      primaryAction={archived ? undefined : primary}
      actions={archived ? primary : edit}
    />
  );
}
