import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PackageDetailView } from '@/features/packages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('packages');
  return { title: t('title') };
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PackageDetailView packageId={packageId} />
    </main>
  );
}
