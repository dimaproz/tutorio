import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsHubPage } from '@/features/settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <SettingsHubPage />
    </div>
  );
}
