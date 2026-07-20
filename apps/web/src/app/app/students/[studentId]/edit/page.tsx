import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentEditView } from '@/components/students/student-edit';

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
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <StudentEditView studentId={studentId} />
      </div>
    </main>
  );
}
