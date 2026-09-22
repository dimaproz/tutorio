'use client';

import { GaugeIcon, GraduationCapIcon, MailIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { ContactRow } from '@/components/shared/contact-row';
import { InfoCard } from '@/components/shared/info-card';

/**
 * How to reach the student. The timezone lives on the hero's meta line and the
 * price on the payment metric, so this card holds only what someone opens it
 * to copy or tap.
 */
export function StudentInformationCard({ student }: { student: StudentDetail }) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const telegram = student.telegramUsername?.replace(/^@/, '');

  return (
    <InfoCard title={t('detail.contactsTitle')}>
      <ContactRow icon={PhoneIcon} mono>
        {student.phone ?? <span className="text-muted-foreground">{tCommon('notProvided')}</span>}
      </ContactRow>
      <ContactRow icon={MailIcon}>
        {student.email ?? <span className="text-muted-foreground">{tCommon('notProvided')}</span>}
      </ContactRow>
      <ContactRow icon={SendIcon}>
        {telegram ? `@${telegram}` : <span className="text-muted-foreground">{tCommon('notProvided')}</span>}
      </ContactRow>
      {student.knowledgeLevel ? (
        <ContactRow icon={GaugeIcon}>{tKnowledge(student.knowledgeLevel)}</ContactRow>
      ) : null}
      {student.languageLevel ? (
        <ContactRow icon={GraduationCapIcon}>{tLanguage(student.languageLevel)}</ContactRow>
      ) : null}
    </InfoCard>
  );
}
