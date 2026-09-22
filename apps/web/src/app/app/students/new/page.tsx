import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentCreatePage } from '@/features/students';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('students.form');
  return { title: t('createTitle') };
}

export default function NewStudentPage() {
  return <StudentCreatePage />;
}
