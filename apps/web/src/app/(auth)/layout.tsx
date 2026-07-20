import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-svh w-full flex-col bg-muted/30">
      <header className="flex items-center justify-between p-4 md:p-6">
        <span className="text-lg font-semibold tracking-tight">{t('appName')}</span>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 pb-12 md:p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
