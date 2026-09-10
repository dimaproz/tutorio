import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ParentsList } from '@/features/parents';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parents');
  return { title: t('title') };
}

export default function ParentsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <ParentsList />
    </div>
  );
}
