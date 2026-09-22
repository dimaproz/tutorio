'use client';

import type { ReactNode } from 'react';
import { MailIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { ProfileHero } from '@/components/shared/profile-hero';

/**
 * The student's identity block. The decorative glyph is their CEFR level when
 * one is recorded, which is also the only part of the design's hero that the
 * student record already carries.
 */
export function StudentProfileHero({
  student,
  statusBadge,
  since,
  meta,
  actions,
}: {
  student: StudentDetail;
  statusBadge: ReactNode;
  since: string;
  meta: string[];
  actions: ReactNode;
}) {
  const t = useTranslations('students.detail');
  const telegram = student.telegramUsername?.replace(/^@/, '');

  const contacts = (
    <>
      {student.phone ? (
        <Button
          asChild
          variant="white"
          size="icon"
          aria-label={t('callContact', { value: student.phone })}
        >
          <a href={`tel:${student.phone}`}>
            <PhoneIcon />
          </a>
        </Button>
      ) : null}
      {telegram ? (
        <Button
          asChild
          variant="white"
          size="icon"
          aria-label={t('messageContact', { value: `@${telegram}` })}
        >
          <a href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer">
            <SendIcon />
          </a>
        </Button>
      ) : null}
      {student.email ? (
        <Button
          asChild
          variant="white"
          size="icon"
          aria-label={t('emailContact', { value: student.email })}
        >
          <a href={`mailto:${student.email}`}>
            <MailIcon />
          </a>
        </Button>
      ) : null}
    </>
  );

  return (
    <ProfileHero
      glyph={student.languageLevel ?? undefined}
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
          {statusBadge}
          <Badge variant="on-tint" size="lg">
            {since}
          </Badge>
        </>
      }
      name={student.fullName}
      meta={meta}
      contacts={student.phone || telegram || student.email ? contacts : undefined}
      actions={actions}
    />
  );
}
