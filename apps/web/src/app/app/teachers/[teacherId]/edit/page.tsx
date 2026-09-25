import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TeacherEditPage } from '@/features/teachers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teachers.form');
  return { title: t('editTitle') };
}

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  return <TeacherEditPage teacherId={teacherId} />;
}
