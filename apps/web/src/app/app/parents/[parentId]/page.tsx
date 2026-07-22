import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ParentDetailView } from '@/components/parents/parent-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parents');
  return { title: t('title') };
}

export default async function ParentDetailPage({
  params,
}: {
  params: Promise<{ parentId: string }>;
}) {
  const { parentId } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ParentDetailView parentId={parentId} />
    </main>
  );
}
