import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ParentEditPage } from '@/features/parents';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parents.form');
  return { title: t('editTitle') };
}

export default async function EditParentPage({
  params,
}: {
  params: Promise<{ parentId: string }>;
}) {
  const { parentId } = await params;
  return <ParentEditPage parentId={parentId} />;
}
