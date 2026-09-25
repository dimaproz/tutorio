import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LessonsPage } from '@/features/lesson-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lessonList');
  return { title: t('title') };
}

export default function LessonsRoute() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <LessonsPage />
    </div>
  );
}
