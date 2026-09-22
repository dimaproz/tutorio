'use client';

import Link from 'next/link';
import { MailIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { ContactRow } from '@/components/shared/contact-row';
import { InfoCard } from '@/components/shared/info-card';

/**
 * How to reach the student. A missing contact becomes the link that adds it,
 * so the card never shows an empty line.
 */
export function StudentInformationCard({
  student,
  readOnly = false,
}: {
  student: StudentDetail;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.detail');
  const telegram = student.telegramUsername?.replace(/^@/, '');
  const editHref = `/app/students/${student.id}/edit`;
  const add = (label: string) =>
    readOnly ? null : (
      <Link
        href={editHref}
        className="font-medium text-tint-indigo-foreground no-underline hover:underline"
      >
        {label}
      </Link>
    );

  const rows = [
    student.phone ? (
      <ContactRow key="phone" icon={PhoneIcon} mono>
        {student.phone}
      </ContactRow>
    ) : null,
    telegram ? (
      <ContactRow key="telegram" icon={SendIcon}>
        @{telegram}
      </ContactRow>
    ) : null,
    student.email ? (
      <ContactRow key="email" icon={MailIcon}>
        {student.email}
      </ContactRow>
    ) : null,
  ].filter(Boolean);

  const missing = [
    !student.phone ? { key: 'phone', icon: PhoneIcon, label: t('addPhone') } : null,
    !telegram ? { key: 'telegram', icon: SendIcon, label: t('addTelegram') } : null,
    !student.email ? { key: 'email', icon: MailIcon, label: t('addEmail') } : null,
  ].filter((item) => item !== null);

  return (
    <InfoCard title={t('contactsTitle')}>
      {rows}
      {missing.map((item) =>
        readOnly ? null : (
          <ContactRow key={item.key} icon={item.icon} className="text-muted-foreground">
            {add(item.label)}
          </ContactRow>
        ),
      )}
      {readOnly && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noContacts')}</p>
      ) : null}
    </InfoCard>
  );
}
