import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GroupsList } from '@/components/groups/groups-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('groups');
  return { title: t('title') };
}

export default function GroupsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <GroupsList />
    </main>
  );
}
