'use client';

import { useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { StatBlock } from '@/components/shared/stat-block';
import { PENDING_VALUE } from '@/features/students/model/pending-data';

/**
 * The profile metric band. The level block is real — it reads the student's
 * recorded CEFR and general level. Credits, money and attendance need the
 * rollups listed in `model/pending-data`, so they hold their place and say
 * they are waiting rather than showing a number nobody can trust.
 */
export function StudentProfileMetrics({ student }: { student: StudentDetail }) {
  const t = useTranslations('students.profileMetrics');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatBlock type="amount" label={t('creditsLeft')} value={PENDING_VALUE} caption={t('pending')} />
      <StatBlock type="amount" label={t('paidThisTerm')} value={PENDING_VALUE} caption={t('pending')} />
      <StatBlock type="amount" label={t('attendance')} value={PENDING_VALUE} caption={t('pending')} />
      {/* The value zone holds a short mark, so the CEFR code leads and the
          localized level name — which can run to several words — is the sub. */}
      <StatBlock
        type="date"
        tone="tint"
        label={t('level')}
        value={student.languageLevel ?? PENDING_VALUE}
        sub={student.languageLevel ? tLanguage(student.languageLevel) : undefined}
        caption={
          student.knowledgeLevel
            ? tKnowledge(student.knowledgeLevel)
            : student.languageLevel
              ? t('levelCaption')
              : t('levelMissing')
        }
      />
    </div>
  );
}
