import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GroupDetailView } from '@/components/groups/group-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('groups');
  return { title: t('title') };
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <GroupDetailView groupId={groupId} />
    </main>
  );
}
