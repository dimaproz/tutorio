import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SchedulesPage } from '@/features/schedules';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schedules');
  return { title: t('title') };
}

export default function SchedulesRoute() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <SchedulesPage />
    </div>
  );
}
