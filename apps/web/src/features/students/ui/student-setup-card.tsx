'use client';

import {
  ArrowRightIcon,
  CalendarIcon,
  BoxIcon,
  HeartIcon,
  LayersIcon,
  PencilIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SetupChecklist } from '@/components/shared/setup-checklist';

const actions = [
  ['lesson', CalendarIcon],
  ['package', BoxIcon],
  ['learning', LayersIcon],
  ['parent', HeartIcon],
  ['profile', PencilIcon],
] as const;

export type StudentSetupAction = (typeof actions)[number][0];

/** The next-step checklist on a freshly created student. */
export function StudentSetupCard({
  onDismiss,
  onAction,
}: {
  onDismiss: () => void;
  onAction: (action: StudentSetupAction) => void;
}) {
  const t = useTranslations('students.setup');
  return (
    <SetupChecklist
      title={t('title')}
      text={t('description')}
      dismissLabel={t('dismiss')}
      onDismiss={onDismiss}
      items={actions.map(([action, Icon]) => ({
        id: action,
        icon: <Icon />,
        title: t(`${action}.title`),
        description: t(`${action}.description`),
        action: (
          <Button type="button" variant="outline" size="xs" onClick={() => onAction(action)}>
            {t(`${action}.action`)}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ),
      }))}
    />
  );
}
