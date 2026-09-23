import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GroupCreatePage } from '@/features/groups';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('groups.form');
  return { title: t('createTitle') };
}

export default function NewGroupPage() {
  return <GroupCreatePage />;
}
