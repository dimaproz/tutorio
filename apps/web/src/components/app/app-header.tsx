'use client';

import { useEffect, useState } from 'react';
import { BellIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

// TailAdmin's header keeps every utility in a 40px circular hit area. The
// quiet primary wash is shared so all header actions read as one control group.
const HEADER_ICON_BUTTON_CLASS =
  'size-10 rounded-full text-foreground hover:bg-lightprimary hover:text-primary focus-visible:bg-lightprimary focus-visible:text-primary dark:hover:bg-lightprimary';

export function AppHeader() {
  const t = useTranslations('app.sidebar');
  const tHeader = useTranslations('app.header');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrolledState = () => setIsScrolled(window.scrollY > 0);

    updateScrolledState();
    window.addEventListener('scroll', updateScrolledState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrolledState);
  }, []);

  return (
    <div className="h-16 shrink-0">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-2 w-auto bg-transparent transition-[background-color,box-shadow] duration-200 md:left-(--sidebar-width)',
          isScrolled && 'bg-background shadow-md',
        )}
      >
        <nav className="h-16 px-2 sm:px-6">
          <div className="mx-auto flex size-full items-center justify-between">
            <div className="flex items-center gap-1">
              <SidebarTrigger aria-label={t('toggle')} className={HEADER_ICON_BUTTON_CLASS} />
              {/* Search stays intentionally quiet until global search ships. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                aria-label={tHeader('searchPlaceholder')}
                title={tHeader('searchPlaceholder')}
                className={`hidden xl:inline-flex ${HEADER_ICON_BUTTON_CLASS} disabled:opacity-100`}
              >
                <SearchIcon data-icon />
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle className={HEADER_ICON_BUTTON_CLASS} />
              <LocaleSwitcher className={HEADER_ICON_BUTTON_CLASS} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                aria-label={tHeader('notifications')}
                title={tHeader('notifications')}
                className={`relative hidden sm:inline-flex ${HEADER_ICON_BUTTON_CLASS} disabled:opacity-100`}
              >
                <BellIcon data-icon />
              </Button>
              <UserMenu className={HEADER_ICON_BUTTON_CLASS} />
            </div>
          </div>
        </nav>
      </header>
    </div>
  );
}
