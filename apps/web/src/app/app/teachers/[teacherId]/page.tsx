import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TeacherDetail } from '@/components/teachers/teacher-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teachers');
  return { title: t('title') };
}

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <TeacherDetail teacherId={teacherId} />
    </main>
  );
}
