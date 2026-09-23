import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GroupEditPage } from '@/features/groups';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('groups.form');
  return { title: t('editTitle') };
}

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return <GroupEditPage groupId={groupId} />;
}
