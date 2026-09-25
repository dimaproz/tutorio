import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CalendarPage } from '@/features/calendar';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendar');
  return { title: t('title') };
}

export default function CalendarRoute() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <CalendarPage />
    </div>
  );
}
