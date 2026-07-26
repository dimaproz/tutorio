import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SeriesManager } from '@/features/scheduling';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('scheduling.patterns');
  return { title: t('title') };
}

export default function PatternsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SeriesManager />
    </main>
  );
}
