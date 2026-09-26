'use client';

import { CheckIcon, GraduationCapIcon, PackageIcon, RepeatIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DashboardSetupResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SetupChecklist, type SetupChecklistItem } from '@/components/shared/setup-checklist';

export type SetupStep = 'teacher' | 'student' | 'schedule' | 'sale';

/** Whether every step the studio has is done: the checklist then disappears. */
export function setupDone(setup: DashboardSetupResponse): boolean {
  return (setup.teacher ?? true) && setup.student && setup.schedule && setup.sale;
}

/**
 * The first run (S11 decision 9): the four steps tick themselves from the
 * data; every step's button is outline. «Додати викладача» is for a studio
 * only.
 */
export function SetupBlock({
  setup,
  onStep,
}: {
  setup: DashboardSetupResponse;
  onStep: (step: SetupStep) => void;
}) {
  const t = useTranslations('today.setup');
  const steps: { id: SetupStep; icon: React.ReactNode; done: boolean }[] = [
    ...(setup.teacher === null
      ? []
      : [{ id: 'teacher' as const, icon: <GraduationCapIcon />, done: setup.teacher }]),
    { id: 'student', icon: <UsersIcon />, done: setup.student },
    { id: 'schedule', icon: <RepeatIcon />, done: setup.schedule },
    { id: 'sale', icon: <PackageIcon />, done: setup.sale },
  ];
  const done = steps.filter((step) => step.done).length;
  const items: SetupChecklistItem[] = steps.map((step) => ({
    id: step.id,
    icon: step.icon,
    title: t(`step.${step.id}.title`),
    description: t(`step.${step.id}.text`),
    action: step.done ? (
      <Badge variant="success">
        <CheckIcon />
        {t('done')}
      </Badge>
    ) : (
      <Button type="button" variant="outline" size="xs" onClick={() => onStep(step.id)}>
        {t(`step.${step.id}.action`)}
      </Button>
    ),
  }));

  return (
    <SetupChecklist
      title={done === 0 ? t('title') : t('progress', { done, total: steps.length })}
      text={t('text')}
      items={items}
      dismissLabel={t('title')}
    />
  );
}
