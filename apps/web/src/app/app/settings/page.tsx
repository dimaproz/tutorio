import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsView } from '@/components/settings/settings-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SettingsView />
    </main>
  );
}
