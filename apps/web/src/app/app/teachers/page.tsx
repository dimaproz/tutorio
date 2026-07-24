import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TeachersList } from '@/components/teachers/teachers-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teachers');
  return { title: t('title') };
}

export default function TeachersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <TeachersList />
    </main>
  );
}
