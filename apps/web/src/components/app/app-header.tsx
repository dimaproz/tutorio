'use client';

import { BellIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { UserMenu } from './user-menu';
import { useSession } from './session-provider';

export function AppHeader() {
  const t = useTranslations('app.sidebar');
  const tHeader = useTranslations('app.header');
  const session = useSession();

  return (
    <header className="bg-card sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-3 md:px-6">
      {/* Larger hit areas on touch screens, compact on md+. */}
      <SidebarTrigger aria-label={t('toggle')} className="size-11 md:size-7" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="min-w-0 truncate text-sm font-medium">{session.workspace.name}</h1>

      {/* Visual only — no search or notifications feature exists yet. */}
      <div className="hidden w-full max-w-xs md:block">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={tHeader('searchPlaceholder')}
            aria-label={tHeader('searchPlaceholder')}
            disabled
          />
        </InputGroup>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled
          aria-label={tHeader('notifications')}
          className="hidden sm:inline-flex"
        >
          <BellIcon />
        </Button>
        <LocaleSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
