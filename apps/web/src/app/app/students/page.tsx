import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentsList } from '@/components/students/students-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('students');
  return { title: t('title') };
}

export default function StudentsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <StudentsList />
    </main>
  );
}
