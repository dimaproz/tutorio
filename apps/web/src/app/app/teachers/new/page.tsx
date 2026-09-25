import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TeacherCreatePage } from '@/features/teachers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teachers.form');
  return { title: t('createTitle') };
}

export default function NewTeacherPage() {
  return <TeacherCreatePage />;
}
