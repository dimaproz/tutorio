import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudentForm } from '@/components/students/student-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('students.form');
  return { title: t('createTitle') };
}

export default function NewStudentPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <StudentForm />
      </div>
    </main>
  );
}
