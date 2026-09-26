import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TodayPage } from '@/features/today';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('today');
  return { title: t('title') };
}

export default function TodayRoute() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <TodayPage />
    </div>
  );
}
