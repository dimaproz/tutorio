import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentDetailView } from '@/components/students/student-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('students');
  return { title: t('title') };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <StudentDetailView studentId={studentId} />
    </main>
  );
}
