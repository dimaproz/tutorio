'use client';

import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { UserMenu } from './user-menu';
import { useSession } from './session-provider';

export function AppHeader() {
  const t = useTranslations('app.sidebar');
  const session = useSession();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
      {/* Larger hit areas on touch screens, compact on md+. */}
      <SidebarTrigger aria-label={t('toggle')} className="size-11 md:size-7" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="min-w-0 truncate text-sm font-medium">{session.workspace.name}</h1>
      <div className="ml-auto flex items-center gap-1">
        <LocaleSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
