'use client';

import { BanknoteIcon, ClockIcon, GaugeIcon, GraduationCapIcon, MailIcon, PhoneIcon, SendIcon, UserRoundIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { InfoRow, SectionTitle } from '@/components/shared/detail-view';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentInformationCard({ student }: { student: StudentDetail }) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const locale = useLocale();
  const missing = <span className="text-muted-foreground">{tCommon('notProvided')}</span>;
  return <Card><CardHeader><SectionTitle icon={UserRoundIcon}>{t('detail.informationTitle')}</SectionTitle></CardHeader><CardContent className="flex flex-col gap-3">
    <InfoRow icon={PhoneIcon} label={t('form.phone')} href={student.phone ? `tel:${student.phone}` : undefined}>{student.phone ?? missing}</InfoRow>
    <InfoRow icon={MailIcon} label={t('form.email')} href={student.email ? `mailto:${student.email}` : undefined}>{student.email ?? missing}</InfoRow>
    <InfoRow icon={SendIcon} label={t('form.telegramUsername')} href={student.telegramUsername ? `https://t.me/${student.telegramUsername.replace(/^@/, '')}` : undefined} external={Boolean(student.telegramUsername)}>{student.telegramUsername ? `@${student.telegramUsername.replace(/^@/, '')}` : missing}</InfoRow>
    <InfoRow icon={BanknoteIcon} label={t('form.pricePerLesson')}>{student.hourlyRateMinor != null && student.currency ? formatMoneyDisplay(student.hourlyRateMinor, student.currency, locale) : missing}</InfoRow>
    <InfoRow icon={ClockIcon} label={t('form.timezone')}>{student.timezone}</InfoRow>
    {student.knowledgeLevel ? <InfoRow icon={GaugeIcon} label={t('form.generalLevel')}>{tKnowledge(student.knowledgeLevel)}</InfoRow> : null}
    {student.languageLevel ? <InfoRow icon={GraduationCapIcon} label={t('form.languageLevelCefr')}>{tLanguage(student.languageLevel)}</InfoRow> : null}
  </CardContent></Card>;
}
