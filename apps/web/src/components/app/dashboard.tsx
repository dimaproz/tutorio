'use client';

import { SparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useSession } from './session-provider';

export function DashboardWelcome() {
  const t = useTranslations('app.dashboard');
  const session = useSession();

  return (
    <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
      {t('welcome', { name: session.user.name })}
    </h2>
  );
}

export function DashboardEmptyState() {
  const t = useTranslations('app.dashboard');

  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
        <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
