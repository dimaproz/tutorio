import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PackagesPage } from '@/features/packages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('packages.list');
  return { title: t('title') };
}

export default function PackagesRoute() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PackagesPage />
    </div>
  );
}
