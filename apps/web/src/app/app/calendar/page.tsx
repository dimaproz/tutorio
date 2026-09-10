import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CalendarView } from '@/features/scheduling';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('scheduling.calendar');
  return { title: t('title') };
}

export default function CalendarPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <CalendarView />
    </div>
  );
}
