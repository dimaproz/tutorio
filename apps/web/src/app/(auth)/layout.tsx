import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common');

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1fr_minmax(26rem,30%)]">
      <aside className="flex flex-col bg-primary/5">
        <div className="flex items-center justify-between gap-4 p-4 md:p-6 lg:p-8">
          <span className="font-heading text-xl font-semibold tracking-tight">{t('appName')}</span>
          <div className="lg:hidden">
            <LocaleSwitcher />
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 items-center justify-center p-6 lg:flex xl:p-10">
          <Image
            src="/images/auth/login-hero.png"
            alt=""
            aria-hidden
            width={800}
            height={1000}
            priority
            className="h-auto max-h-[calc(100svh-11rem)] w-auto max-w-full"
          />
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="hidden justify-end p-6 lg:flex lg:p-8">
          <LocaleSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center p-4 pb-12 md:p-6 lg:px-8 lg:pt-0">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
