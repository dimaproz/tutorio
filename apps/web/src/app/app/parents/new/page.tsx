import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ParentCreatePage } from '@/features/parents';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parents.form');
  return { title: t('createTitle') };
}

export default function NewParentPage() {
  return <ParentCreatePage />;
}
