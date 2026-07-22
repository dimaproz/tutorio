import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ParentsList } from '@/components/parents/parents-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parents');
  return { title: t('title') };
}

export default function ParentsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ParentsList />
    </main>
  );
}
