import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CalendarView } from '@/components/scheduling/calendar-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('scheduling.calendar');
  return { title: t('title') };
}

export default function CalendarPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <CalendarView />
    </main>
  );
}
