import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentEditPage } from '@/features/students';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('students.form');
  return { title: t('editTitle') };
}

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <StudentEditPage studentId={studentId} />;
}
