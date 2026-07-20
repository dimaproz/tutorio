import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardEmptyState, DashboardWelcome } from '@/components/app/dashboard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app.nav');
  return { title: t('dashboard') };
}

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <DashboardWelcome />
      <DashboardEmptyState />
    </main>
  );
}
